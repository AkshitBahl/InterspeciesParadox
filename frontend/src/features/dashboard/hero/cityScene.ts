import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/*
  The neighborhood in real 3D, for the home page fly through.

  It reads the same GeoJSON as the map (buildings with their heights, gardens, the pond, routes,
  people and animals) and builds a glowing city from it, with a made up skyline around it.
  The scroll position (0 to 1) picks a point on a smooth camera path. The camera never jumps to
  that point: each frame it moves a small part of the remaining distance (interpolation), so the
  flight stays silky even when the wheel is jerky.
*/

type Coord = [number, number] | [number, number, number];

interface Feature {
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

export interface CityData {
  features: Feature[];
  metadata?: { center?: [number, number] };
}

export interface CityLabel {
  id: string;
  emoji: string;
  name: string;
  kind: "animal" | "person";
  position: THREE.Vector3;
}

export interface ScreenPoint {
  x: number;
  y: number;
  /** 0 when far away or off screen, up to 1 when close. */
  strength: number;
}

export interface CityScene {
  labels: CityLabel[];
  setProgress: (progress: number) => void;
  setPointer: (x: number, y: number) => void;
  setRunning: (running: boolean) => void;
  /** Called after every frame with a projector for the label overlay. */
  onFrame: ((project: (point: THREE.Vector3) => ScreenPoint, progress: number) => void) | null;
  resize: () => void;
  dispose: () => void;
}

const MINT = 0x3dffb0;
const PEOPLE = 0x4cc9ff;
const ANIMALS = 0xff8a3d;
const CONFLICT = 0xff3b5c;
const FIX = 0xb388ff;
const HOME = 0xffc24b;
const HEIGHT_SCALE = 1.2;

/* ---------- small helpers ---------- */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function glowTexture(inner: string, outer: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.35, outer);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function emojiTexture(emoji: string, ring: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  const halo = ctx.createRadialGradient(80, 80, 20, 80, 80, 80);
  halo.addColorStop(0, ring.replace("ALPHA", "0.55"));
  halo.addColorStop(1, ring.replace("ALPHA", "0"));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 160, 160);
  ctx.beginPath();
  ctx.arc(80, 80, 46, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(3, 20, 15, 0.92)";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = ring.replace("ALPHA", "1");
  ctx.stroke();
  ctx.font = "54px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 80, 84);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ---------- the scene ---------- */

export function createCityScene(host: HTMLElement, data: CityData, options: { still: boolean }): CityScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x020c09, 1);
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020c09);
  scene.fog = new THREE.FogExp2(0x03140f, 0.00105);

  const camera = new THREE.PerspectiveCamera(48, 1, 1, 7000);
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item);
    return item;
  };

  /* Map coordinates (longitude, latitude) to metres around the district centre. */
  const center = data.metadata?.center ?? [4.374, 50.824];
  const kx = 111320 * Math.cos((center[1] * Math.PI) / 180);
  const kz = 110540;
  const east = (c: Coord) => (c[0] - center[0]) * kx;
  const north = (c: Coord) => (c[1] - center[1]) * kz;
  const toWorld = (c: Coord, y = 0) => new THREE.Vector3(east(c), y, -north(c));

  const byLayer = (layer: string) => data.features.filter((f) => f.properties.layer === layer);
  const ringOf = (f: Feature) => ((f.geometry.coordinates as Coord[][])[0] ?? []) as Coord[];
  const shapeOf = (ring: Coord[]) => new THREE.Shape(ring.map((c) => new THREE.Vector2(east(c), north(c))));

  /* Lights */
  scene.add(new THREE.AmbientLight(0x3dffb0, 0.18));
  scene.add(new THREE.HemisphereLight(0x8fffe0, 0x020c09, 0.45));
  const moon = new THREE.DirectionalLight(0xc8fff0, 0.7);
  moon.position.set(300, 520, 260);
  scene.add(moon);

  /* Ground and grid */
  const ground = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(6000, 6000)),
    keep(new THREE.MeshStandardMaterial({ color: 0x03140f, roughness: 1, metalness: 0 }))
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(3200, 160, MINT, MINT);
  const gridMaterial = grid.material as THREE.LineBasicMaterial;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.09;
  gridMaterial.depthWrite = false;
  grid.position.y = 0.05;
  keep(grid.geometry);
  keep(gridMaterial);
  scene.add(grid);

  /* A soft solarpunk sun far away on the horizon */
  const sunTexture = keep(glowTexture("rgba(190,255,225,0.95)", "rgba(61,255,176,0.35)"));
  const sun = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: sunTexture, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.55 })));
  sun.scale.set(900, 900, 1);
  sun.position.set(-420, 70, -2300);
  scene.add(sun);
  const sunRingMaterial = keep(new THREE.MeshBasicMaterial({ color: MINT, fog: false, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  for (const [inner, outer] of [[300, 304], [345, 347], [392, 393.5]]) {
    const ring = new THREE.Mesh(keep(new THREE.RingGeometry(inner, outer, 128)), sunRingMaterial);
    ring.position.copy(sun.position);
    scene.add(ring);
  }

  /* District buildings, extruded to their real heights, with neon edges and floor lines */
  const buildingMaterial = keep(new THREE.MeshStandardMaterial({ color: 0x0b2c22, emissive: 0x05261a, roughness: 0.55, metalness: 0.25 }));
  const edgeMaterial = keep(new THREE.LineBasicMaterial({ color: MINT, transparent: true, opacity: 0.95 }));
  const floorLinePoints: number[] = [];
  const roofs: { x: number; z: number; y: number; radius: number }[] = [];
  let towerTop = new THREE.Vector3(-175, 96, -115);

  for (const building of byLayer("building")) {
    const ring = ringOf(building);
    if (ring.length < 3) continue;
    const height = Number(building.properties.height_m ?? 10) * HEIGHT_SCALE;
    const geometry = keep(new THREE.ExtrudeGeometry(shapeOf(ring), { depth: height, bevelEnabled: false }));
    geometry.rotateX(-Math.PI / 2);
    scene.add(new THREE.Mesh(geometry, buildingMaterial));
    const edges = keep(new THREE.EdgesGeometry(geometry, 20));
    scene.add(new THREE.LineSegments(edges, edgeMaterial));

    for (let y = 3.6; y < height - 1; y += 3.6) {
      for (let i = 0; i < ring.length - 1; i += 1) {
        const a = toWorld(ring[i], y);
        const b = toWorld(ring[i + 1], y);
        floorLinePoints.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const box = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute("position") as THREE.BufferAttribute);
    const middle = box.getCenter(new THREE.Vector3());
    roofs.push({ x: middle.x, z: middle.z, y: height, radius: Math.min(box.max.x - box.min.x, box.max.z - box.min.z) * 0.35 });
    if (height > towerTop.y - 1) towerTop = new THREE.Vector3(middle.x, height, middle.z);
  }

  const floorLines = new THREE.BufferGeometry();
  floorLines.setAttribute("position", new THREE.Float32BufferAttribute(floorLinePoints, 3));
  keep(floorLines);
  scene.add(new THREE.LineSegments(floorLines, keep(new THREE.LineBasicMaterial({ color: MINT, transparent: true, opacity: 0.16 }))));

  /* Gardens, meadows, hedges and the pond */
  const random = mulberry32(2126);
  const treeSpots: THREE.Vector3[] = [];
  for (const zone of byLayer("habitat_zone")) {
    const ring = ringOf(zone);
    if (ring.length < 3) continue;
    const habitat = String(zone.properties.habitat ?? "");
    const y = (Number(zone.properties.height_m ?? 0) || 0) * HEIGHT_SCALE + 0.35;
    const water = habitat === "wetland";
    const geometry = keep(new THREE.ShapeGeometry(shapeOf(ring)));
    geometry.rotateX(-Math.PI / 2);
    const fill = new THREE.Mesh(
      geometry,
      keep(new THREE.MeshBasicMaterial({ color: water ? 0x0fb8b0 : 0x1fd68a, transparent: true, opacity: water ? 0.32 : 0.17, depthWrite: false }))
    );
    fill.position.y = y;
    scene.add(fill);
    const outline = new THREE.LineLoop(
      keep(new THREE.BufferGeometry().setFromPoints(ring.map((c) => toWorld(c, y + 0.1)))),
      keep(new THREE.LineBasicMaterial({ color: water ? 0x4cf0e6 : MINT, transparent: true, opacity: 0.7 }))
    );
    scene.add(outline);

    if (!water) {
      const box = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute("position") as THREE.BufferAttribute);
      const polygon = ring.map((c) => new THREE.Vector2(east(c), -north(c)));
      const area = (box.max.x - box.min.x) * (box.max.z - box.min.z);
      const wanted = Math.min(70, Math.max(6, Math.round(area / 140)));
      for (let tries = 0, placed = 0; tries < wanted * 6 && placed < wanted; tries += 1) {
        const x = box.min.x + random() * (box.max.x - box.min.x);
        const z = box.min.z + random() * (box.max.z - box.min.z);
        if (insidePolygon(x, z, polygon)) {
          treeSpots.push(new THREE.Vector3(x, y, z));
          placed += 1;
        }
      }
    }
  }

  /* Rooftop gardens on the district buildings */
  for (const roof of roofs) {
    for (let i = 0; i < 7; i += 1) {
      const angle = random() * Math.PI * 2;
      const distance = random() * roof.radius;
      treeSpots.push(new THREE.Vector3(roof.x + Math.cos(angle) * distance, roof.y, roof.z + Math.sin(angle) * distance));
    }
  }

  const treeGeometry = keep(new THREE.ConeGeometry(1.7, 5.4, 6));
  treeGeometry.translate(0, 2.7, 0);
  const trees = new THREE.InstancedMesh(treeGeometry, keep(new THREE.MeshStandardMaterial({ color: 0x1a8f5c, emissive: 0x0f7a4a, emissiveIntensity: 0.9, roughness: 0.7 })), treeSpots.length);
  const matrix = new THREE.Matrix4();
  treeSpots.forEach((spot, i) => {
    const s = 0.6 + random() * 0.6;
    matrix.compose(spot, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * 6.28), new THREE.Vector3(s, s * (0.8 + random() * 0.6), s));
    trees.setMatrixAt(i, matrix);
  });
  scene.add(trees);

  /* Quiet zones around animal homes: dashed amber outlines */
  const bufferMaterial = keep(new THREE.LineDashedMaterial({ color: HOME, dashSize: 2.4, gapSize: 2, transparent: true, opacity: 0.55 }));
  for (const zone of byLayer("ecological_buffer")) {
    const ring = ringOf(zone);
    if (ring.length < 3) continue;
    const line = new THREE.LineLoop(keep(new THREE.BufferGeometry().setFromPoints(ring.map((c) => toWorld(c, 0.6)))), bufferMaterial);
    line.computeLineDistances();
    scene.add(line);
  }

  /* Routes as glowing tubes, with lights travelling along them */
  const movers: { curve: THREE.CatmullRomCurve3; offset: number; speed: number }[] = [];
  const routeStyles: Record<string, { color: number; radius: number; opacity: number }> = {
    human_route: { color: PEOPLE, radius: 0.45, opacity: 0.85 },
    wildlife_corridor: { color: ANIMALS, radius: 0.38, opacity: 0.7 },
    delivery_route: { color: FIX, radius: 0.38, opacity: 0.6 },
  };
  for (const [layer, style] of Object.entries(routeStyles)) {
    const material = keep(new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: style.opacity }));
    for (const route of byLayer(layer)) {
      const coords = route.geometry.coordinates as Coord[];
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const points = coords.map((c) => toWorld(c, 0.9));
      const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.1);
      const tube = keep(new THREE.TubeGeometry(curve, Math.max(16, points.length * 10), style.radius, 5, false));
      scene.add(new THREE.Mesh(tube, material));
      const length = curve.getLength();
      const count = length > 120 ? 2 : 1;
      for (let i = 0; i < count; i += 1) movers.push({ curve, offset: random(), speed: 14 / Math.max(30, length) });
    }
  }

  const sparkTexture = keep(glowTexture("rgba(255,255,255,1)", "rgba(160,255,220,0.55)"));
  const moverGeometry = keep(new THREE.BufferGeometry());
  const moverPositions = new Float32Array(movers.length * 3);
  moverGeometry.setAttribute("position", new THREE.BufferAttribute(moverPositions, 3));
  const moverPoints = new THREE.Points(moverGeometry, keep(new THREE.PointsMaterial({ map: sparkTexture, size: 7, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xcffff0 })));
  scene.add(moverPoints);

  /* Animals, people, conflicts */
  const labels: CityLabel[] = [];
  const pulses: { mesh: THREE.Mesh; base: number; phase: number }[] = [];
  const beaconMaterial = keep(new THREE.MeshBasicMaterial({ color: ANIMALS, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  const ringGeometry = keep(new THREE.RingGeometry(0.82, 1, 48));
  ringGeometry.rotateX(-Math.PI / 2);

  const animalNames = new Map<string, string>();
  for (const animal of byLayer("wildlife")) animalNames.set(String(animal.properties.species_slug ?? ""), String(animal.properties.name ?? ""));

  let foxDen = new THREE.Vector3(-108, 0, 86);
  for (const site of byLayer("wildlife_site")) {
    const coords = site.geometry.coordinates as Coord;
    const height = (Number(site.properties.height_m ?? 0) || 0) * HEIGHT_SCALE;
    const base = toWorld(coords, height + 0.4);
    const slug = String(site.properties.species_slug ?? "");
    if (slug === "red-fox") foxDen = base.clone();
    const emoji = String(site.properties.emoji ?? "🐾");

    const beam = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.22, 0.22, 26, 8, 1, true)), beaconMaterial);
    beam.position.set(base.x, base.y + 13, base.z);
    scene.add(beam);

    const pulse = new THREE.Mesh(ringGeometry, keep(new THREE.MeshBasicMaterial({ color: ANIMALS, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })));
    pulse.position.copy(base);
    pulse.scale.setScalar(6);
    scene.add(pulse);
    pulses.push({ mesh: pulse, base: 6, phase: random() * Math.PI * 2 });

    const sprite = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(emojiTexture(emoji, "rgba(255,138,61,ALPHA)")), transparent: true, depthWrite: false })));
    sprite.scale.set(13, 13, 1);
    sprite.position.set(base.x, base.y + 30, base.z);
    scene.add(sprite);
    labels.push({ id: slug, emoji, name: animalNames.get(slug) ?? String(site.properties.species_name ?? "Neighbor"), kind: "animal", position: sprite.position.clone().add(new THREE.Vector3(0, 9, 0)) });
  }

  for (const person of byLayer("resident")) {
    const base = toWorld(person.geometry.coordinates as Coord, 1.2);
    const sprite = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(emojiTexture(String(person.properties.emoji ?? "🙂"), "rgba(76,201,255,ALPHA)")), transparent: true, depthWrite: false })));
    sprite.scale.set(8, 8, 1);
    sprite.position.set(base.x, base.y + 8, base.z);
    scene.add(sprite);
    const ring = new THREE.Mesh(ringGeometry, keep(new THREE.MeshBasicMaterial({ color: PEOPLE, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })));
    ring.position.copy(base);
    ring.scale.setScalar(3.4);
    scene.add(ring);
  }

  const conflictMaterial = keep(new THREE.MeshBasicMaterial({ color: CONFLICT, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  for (const spot of byLayer("conflict_hotspot")) {
    const base = toWorld(spot.geometry.coordinates as Coord, 0.5);
    for (let k = 0; k < 2; k += 1) {
      const ring = new THREE.Mesh(ringGeometry, conflictMaterial.clone());
      keep(ring.material as THREE.Material);
      ring.position.copy(base);
      scene.add(ring);
      pulses.push({ mesh: ring, base: -10, phase: k * Math.PI });
    }
  }

  const fixMaterial = keep(new THREE.MeshStandardMaterial({ color: FIX, emissive: FIX, emissiveIntensity: 1.4 }));
  const fixes: THREE.Mesh[] = [];
  for (const spot of byLayer("intervention")) {
    const gem = new THREE.Mesh(keep(new THREE.OctahedronGeometry(3)), fixMaterial);
    gem.position.copy(toWorld(spot.geometry.coordinates as Coord, 9));
    scene.add(gem);
    fixes.push(gem);
  }

  /* A made up skyline around the district, fading into the fog */
  const towers: { x: number; z: number; w: number; d: number; h: number }[] = [];
  for (let gx = -16; gx <= 16; gx += 1) {
    for (let gz = -16; gz <= 12; gz += 1) {
      const x = gx * 74 + (random() - 0.5) * 26;
      const z = gz * 74 + (random() - 0.5) * 26;
      if (Math.abs(x) < 290 && z > -290 && z < 230) continue;
      if (random() < 0.42) continue;
      const far = Math.min(1, Math.hypot(x, z) / 1200);
      towers.push({ x, z, w: 22 + random() * 26, d: 22 + random() * 26, h: 14 + random() * (40 + far * 120) });
    }
  }
  const towerGeometry = keep(new THREE.BoxGeometry(1, 1, 1));
  towerGeometry.translate(0, 0.5, 0);
  const skyline = new THREE.InstancedMesh(towerGeometry, keep(new THREE.MeshStandardMaterial({ color: 0x061d16, emissive: 0x03140f, roughness: 0.8 })), towers.length);
  const edgeCorners = [
    [-1, -1], [1, -1], [1, 1], [-1, 1],
  ];
  const skylineEdges: number[] = [];
  const windows: number[] = [];
  const windowColors: number[] = [];
  const palette = [new THREE.Color(MINT), new THREE.Color(PEOPLE), new THREE.Color(0xffd27a), new THREE.Color(0xcffff0)];
  const gardens: THREE.Vector3[] = [];
  towers.forEach((tower, i) => {
    matrix.compose(new THREE.Vector3(tower.x, 0, tower.z), new THREE.Quaternion(), new THREE.Vector3(tower.w, tower.h, tower.d));
    skyline.setMatrixAt(i, matrix);
    const corners = edgeCorners.map(([sx, sz]) => [tower.x + (sx * tower.w) / 2, tower.z + (sz * tower.d) / 2]);
    for (let c = 0; c < 4; c += 1) {
      const [ax, az] = corners[c];
      const [bx, bz] = corners[(c + 1) % 4];
      skylineEdges.push(ax, tower.h, az, bx, tower.h, bz); // roof rim
      skylineEdges.push(ax, 0, az, ax, tower.h, az); // vertical edge
    }
    const lit = Math.round(tower.h / 9);
    for (let k = 0; k < lit; k += 1) {
      const face = Math.floor(random() * 4);
      const along = random() - 0.5;
      const y = 4 + random() * (tower.h - 6);
      const wx = face < 2 ? tower.x + along * tower.w : tower.x + (face === 2 ? 0.5 : -0.5) * tower.w * 1.02;
      const wz = face < 2 ? tower.z + (face === 0 ? 0.5 : -0.5) * tower.d * 1.02 : tower.z + along * tower.d;
      windows.push(wx, y, wz);
      const color = palette[Math.floor(random() * palette.length)];
      windowColors.push(color.r, color.g, color.b);
    }
    if (random() < 0.35) gardens.push(new THREE.Vector3(tower.x, tower.h, tower.z));
  });
  scene.add(skyline);

  const skylineGeometry = keep(new THREE.BufferGeometry());
  skylineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(skylineEdges, 3));
  scene.add(new THREE.LineSegments(skylineGeometry, keep(new THREE.LineBasicMaterial({ color: MINT, transparent: true, opacity: 0.32 }))));

  const windowGeometry = keep(new THREE.BufferGeometry());
  windowGeometry.setAttribute("position", new THREE.Float32BufferAttribute(windows, 3));
  windowGeometry.setAttribute("color", new THREE.Float32BufferAttribute(windowColors, 3));
  scene.add(new THREE.Points(windowGeometry, keep(new THREE.PointsMaterial({ size: 2.6, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }))));

  const gardenGeometry = keep(new THREE.CylinderGeometry(1, 1, 1.4, 10));
  const roofGardens = new THREE.InstancedMesh(gardenGeometry, keep(new THREE.MeshStandardMaterial({ color: 0x1a8f5c, emissive: 0x168a55, emissiveIntensity: 1 })), gardens.length);
  gardens.forEach((spot, i) => {
    const towerSize = 6 + random() * 7;
    matrix.compose(spot.clone().setY(spot.y + 0.7), new THREE.Quaternion(), new THREE.Vector3(towerSize, 1, towerSize));
    roofGardens.setMatrixAt(i, matrix);
  });
  scene.add(roofGardens);

  /* Floating spores everywhere */
  const sporeCount = 1400;
  const spores = new Float32Array(sporeCount * 3);
  for (let i = 0; i < sporeCount; i += 1) {
    spores[i * 3] = (random() - 0.5) * 1600;
    spores[i * 3 + 1] = 4 + random() * 260;
    spores[i * 3 + 2] = (random() - 0.5) * 1600;
  }
  const sporeGeometry = keep(new THREE.BufferGeometry());
  sporeGeometry.setAttribute("position", new THREE.BufferAttribute(spores, 3));
  const sporeField = new THREE.Points(sporeGeometry, keep(new THREE.PointsMaterial({ map: sparkTexture, size: 3.2, color: 0x8dffd0, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })));
  scene.add(sporeField);

  /* The camera path: high above the district, round the solar tower, down to the fox den */
  const pathPoints = [
    new THREE.Vector3(230, 330, 520),
    new THREE.Vector3(-430, 190, 330),
    new THREE.Vector3(towerTop.x + 120, towerTop.y + 18, towerTop.z + 150),
    new THREE.Vector3(40, 72, 95),
    new THREE.Vector3(foxDen.x + 78, 50, foxDen.z + 98),
  ];
  const lookPoints = [
    new THREE.Vector3(-175, 25, -70),
    new THREE.Vector3(-60, 20, -30),
    new THREE.Vector3(towerTop.x, towerTop.y - 14, towerTop.z),
    new THREE.Vector3(-70, 8, 70),
    new THREE.Vector3(foxDen.x - 8, 0, foxDen.z - 8),
  ];
  const cameraPath = new THREE.CatmullRomCurve3(pathPoints, false, "centripetal");
  const lookPath = new THREE.CatmullRomCurve3(lookPoints, false, "centripetal");

  /* Post processing: bloom makes the neon lines glow */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.95, 0.55, 0.1);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* State */
  let target = 0;
  let progress = 0;
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let running = true;
  let frame = 0;
  let disposed = false;
  let lastTime = performance.now();
  let elapsed = 0;
  const position = new THREE.Vector3();
  const look = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const projected = new THREE.Vector3();
  const api: CityScene = {
    labels,
    onFrame: null,
    setProgress: (value) => {
      target = Math.min(1, Math.max(0, value));
      wake();
    },
    setPointer: (x, y) => {
      pointerTargetX = x;
      pointerTargetY = y;
      wake();
    },
    setRunning: (value) => {
      running = value;
      wake();
    },
    resize,
    dispose,
  };

  function wake() {
    if (running && !frame && !disposed) {
      lastTime = performance.now();
      frame = requestAnimationFrame(loop);
    }
  }

  function project(point: THREE.Vector3): ScreenPoint {
    projected.copy(point).project(camera);
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    const onScreen = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
    const distance = camera.position.distanceTo(point);
    return {
      x: ((projected.x + 1) / 2) * width,
      y: ((1 - projected.y) / 2) * height,
      strength: onScreen ? smooth((520 - distance) / 380) : 0,
    };
  }

  function placeCamera(time: number) {
    const t = smooth(progress) * 0.94 + progress * 0.06;
    cameraPath.getPoint(t, position);
    lookPath.getPoint(t, look);
    // Before you scroll, the camera drifts in a slow circle so the city feels alive.
    const idle = (1 - smooth(progress * 4)) * (options.still ? 0 : 1);
    position.x += Math.sin(time * 0.12) * 26 * idle;
    position.z += Math.cos(time * 0.12) * 18 * idle;
    // The pointer nudges the camera sideways and up: depth you can feel with the mouse.
    camera.position.copy(position);
    camera.lookAt(look);
    right.setFromMatrixColumn(camera.matrix, 0);
    const reach = 10 + 22 * (1 - progress);
    camera.position.addScaledVector(right, pointerX * reach).addScaledVector(up, -pointerY * reach * 0.5);
    camera.lookAt(look);
  }

  function loop() {
    frame = 0;
    if (disposed || !running) return;
    const now = performance.now();
    const delta = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    elapsed += delta;
    const time = elapsed;
    const ease = 1 - Math.pow(0.0009, delta); // the same glide at 60 or 120 frames per second
    progress += (target - progress) * ease;
    pointerX += (pointerTargetX - pointerX) * ease * 0.6;
    pointerY += (pointerTargetY - pointerY) * ease * 0.6;
    placeCamera(time);
    bloom.strength = 0.95 - progress * 0.4;

    if (!options.still) {
      for (let i = 0; i < movers.length; i += 1) {
        const mover = movers[i];
        const point = mover.curve.getPointAt((mover.offset + time * mover.speed) % 1);
        moverPositions[i * 3] = point.x;
        moverPositions[i * 3 + 1] = point.y + 0.4;
        moverPositions[i * 3 + 2] = point.z;
      }
      moverGeometry.attributes.position.needsUpdate = true;
      for (const pulse of pulses) {
        if (pulse.base > 0) {
          const wave = (Math.sin(time * 2.2 + pulse.phase) + 1) / 2;
          pulse.mesh.scale.setScalar(pulse.base * (1 + wave * 0.6));
          (pulse.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 - wave * 0.6;
        } else {
          const cycle = ((time * 0.6 + pulse.phase / (Math.PI * 2)) % 1 + 1) % 1;
          pulse.mesh.scale.setScalar(3 + cycle * 11);
          (pulse.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - cycle);
        }
      }
      for (const gem of fixes) {
        gem.rotation.y = time * 0.9;
        gem.position.y = 9 + Math.sin(time * 1.6) * 1.2;
      }
      sporeField.rotation.y = time * 0.006;
      sporeField.position.y = Math.sin(time * 0.3) * 3;
    }

    composer.render(delta);
    api.onFrame?.(project, progress);
    const settling = Math.abs(target - progress) > 0.0005 || Math.abs(pointerTargetX - pointerX) > 0.001 || Math.abs(pointerTargetY - pointerY) > 0.001;
    if (!options.still || settling) frame = requestAnimationFrame(loop);
  }

  function resize() {
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    bloom.resolution.set(width / 2, height / 2);
    camera.aspect = width / height;
    // On narrow screens pull the camera wider so the district still fits.
    camera.fov = width / height < 0.8 ? 62 : 48;
    camera.updateProjectionMatrix();
    wake();
  }

  function renderOnce() {
    placeCamera(elapsed);
    composer.render(0);
  }

  function dispose() {
    disposed = true;
    cancelAnimationFrame(frame);
    for (const item of disposables) item.dispose();
    skyline.dispose();
    trees.dispose();
    roofGardens.dispose();
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }

  resize();
  renderOnce();
  return api;
}

function insidePolygon(x: number, z: number, polygon: THREE.Vector2[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > z !== b.y > z && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
