import { useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type ExpressionSpecification,
  type FilterSpecification,
  type GeoJSONSource,
  type LayerSpecification,
  type MapMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";

import { boundsOf, linesOf, pointOf, polygonsOf, tidy, type MapFeature } from "./mapData";
import { COLORS, categoryOf, typeLabel, type CategoryKey } from "./mapStyle";
import { markerLook } from "./markers";

// Vite gives the worker its own URL; MapLibre would otherwise look for it next to the bundle.
setWorkerUrl(workerUrl);

export interface MapPadding {
  topLeft: [number, number];
  bottomRight: [number, number];
}

/** How much of the map the details card covers (pixels from the right and bottom edges). */
export interface DetailsInset {
  right: number;
  bottom: number;
}

export interface FocusRequest {
  id: string;
  nonce: number;
}

interface Props {
  features: MapFeature[];
  visible: Set<CategoryKey>;
  selectedId: string | null;
  /** Features linked to the selection (same species). Everything else is faded. */
  relatedIds: Set<string> | null;
  playingId: string | null;
  showRealMap: boolean;
  onSelect: (feature: MapFeature | null) => void;
  focus?: FocusRequest | null;
  padding?: MapPadding;
  /** Space covered by a details card, so selections are never hidden under it. */
  detailsInset?: DetailsInset;
  /** Changes when the map should zoom to fit the data again (e.g. a new plan). */
  fitKey?: string;
  /** Embedded maps don't grab the scroll wheel. */
  scrollWheelZoom?: boolean;
  /** Start around this point ([lat, lon]) instead of fitting the whole neighborhood. */
  initialCenter?: [number, number];
  className?: string;
}

type LonLat = [number, number];

const DEFAULT_PADDING: MapPadding = { topLeft: [24, 24], bottomRight: [24, 24] };
const NO_INSET: DetailsInset = { right: 0, bottom: 0 };
const NOT_DIMMED: CategoryKey[] = ["city", "entrances"];
const SOURCE = "kin";
const FLOW_SOURCE = "kin-flow";
/** The slightly tilted, slightly turned camera that makes the city look 3D. */
const TILT = { pitch: 52, bearing: -16 };
const CENTER: LonLat = [4.3738, 50.8242];
const AREA = { west: 4.3605, east: 4.3875, south: 50.817, north: 50.8315 };

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// --- style helpers ----------------------------------------------------------------------

const get = (key: string): ExpressionSpecification => ["get", key];
const is = (key: string, value: string | number | boolean): ExpressionSpecification => ["==", ["get", key], value];
const LINE: ExpressionSpecification = ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]];
const POLY: ExpressionSpecification = ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]];
const DIM = is("_dim", 1);
const HOVER: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];
const INACTIVE = is("active_now", false);
/** Full strength normally, faint when the feature is not linked to the selection. */
const fade = (on: number, off: number): ExpressionSpecification => ["case", DIM, off, on];
/** Widths grow with zoom so the map reads well from far and close. */
const zoomed = (far: number, near: number): ExpressionSpecification => ["interpolate", ["exponential", 1.5], ["zoom"], 15, far, 19.5, near];
const cat = (...keys: CategoryKey[]): ExpressionSpecification => ["in", get("_cat"), ["literal", keys]];
const all = (...parts: ExpressionSpecification[]): FilterSpecification => ["all", ...parts] as FilterSpecification;

const ROUTE_CATS: CategoryKey[] = ["people_routes", "animal_paths", "deliveries", "fixes"];
const CAT_COLOR: ExpressionSpecification = [
  "match",
  get("_cat"),
  "people_routes",
  COLORS.people,
  "animal_paths",
  COLORS.animals,
  "deliveries",
  COLORS.delivery,
  "fixes",
  COLORS.fix,
  COLORS.streetLight,
];
const ROUND = { "line-cap": "round", "line-join": "round" } as const;
const HEIGHT: ExpressionSpecification = ["coalesce", get("height_m"), 10];

/** Layers people can click or hover, top first. */
const INTERACTIVE = ["barrier-line", "animal-line", "delivery-line", "people-line", "fix-fill", "quiet-fill", "building", "green-roof", "nature-fill", "street"];

/** A faint holographic grid under the whole district. */
function gridLines(): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];
  const line = (coordinates: LonLat[], major: boolean) => features.push({ type: "Feature", properties: { major: major ? 1 : 0 }, geometry: { type: "LineString", coordinates } });
  for (let i = 0; AREA.west + i * 0.0003 <= AREA.east; i++) line([[AREA.west + i * 0.0003, AREA.south], [AREA.west + i * 0.0003, AREA.north]], i % 5 === 0);
  for (let i = 0; AREA.south + i * 0.0002 <= AREA.north; i++) line([[AREA.west, AREA.south + i * 0.0002], [AREA.east, AREA.south + i * 0.0002]], i % 5 === 0);
  return { type: "FeatureCollection", features };
}

function buildStyle(): StyleSpecification {
  const layers: LayerSpecification[] = [
    { id: "ground", type: "background", paint: { "background-color": COLORS.ground } },
    {
      id: "osm",
      type: "raster",
      source: "osm",
      layout: { visibility: "none" },
      // Inverted, grey and faint: real Brussels as a ghost under the 2126 city.
      paint: { "raster-brightness-min": 1, "raster-brightness-max": 0, "raster-saturation": -1, "raster-opacity": 0.2 },
    },
    {
      id: "grid",
      type: "line",
      source: "grid",
      paint: {
        "line-color": ["case", is("major", 1), "#135a41", COLORS.grid],
        "line-width": ["case", is("major", 1), 1, 0.6],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0.35, 18, 0.85],
      },
    },

    // Nature: dark fills with a neon edge. The pond glows teal.
    {
      id: "nature-fill",
      type: "fill",
      source: SOURCE,
      filter: all(POLY, cat("nature"), ["!=", get("habitat"), "green_roof"]),
      paint: { "fill-color": ["case", is("habitat", "wetland"), COLORS.waterFill, COLORS.natureFill], "fill-opacity": fade(0.92, 0.3) },
    },
    {
      id: "nature-glow",
      type: "line",
      source: SOURCE,
      filter: all(POLY, cat("nature"), ["!=", get("habitat"), "green_roof"]),
      layout: ROUND,
      paint: {
        "line-color": ["case", is("habitat", "wetland"), COLORS.water, COLORS.nature],
        "line-width": zoomed(4, 16),
        "line-blur": zoomed(3, 12),
        "line-opacity": ["case", DIM, 0.05, HOVER, 0.7, 0.32],
      },
    },
    {
      id: "nature-line",
      type: "line",
      source: SOURCE,
      filter: all(POLY, cat("nature"), ["!=", get("habitat"), "green_roof"]),
      layout: ROUND,
      paint: { "line-color": ["case", is("habitat", "wetland"), COLORS.water, COLORS.nature], "line-width": zoomed(0.7, 1.8), "line-opacity": fade(0.9, 0.15) },
    },

    // Streets: dark lanes with thin glowing kerbs.
    { id: "street", type: "line", source: SOURCE, filter: all(LINE, cat("city")), layout: ROUND, paint: { "line-color": "#0b2c23", "line-width": zoomed(5, 30) } },
    {
      id: "street-kerb",
      type: "line",
      source: SOURCE,
      filter: all(LINE, cat("city")),
      layout: ROUND,
      paint: { "line-color": COLORS.streetLight, "line-width": zoomed(0.5, 1.2), "line-gap-width": zoomed(5, 30), "line-blur": 0.6, "line-opacity": 0.5 },
    },
    {
      id: "street-centre",
      type: "line",
      source: SOURCE,
      filter: all(LINE, cat("city")),
      layout: ROUND,
      paint: { "line-color": COLORS.streetLight, "line-width": zoomed(0.3, 0.9), "line-opacity": 0.28, "line-dasharray": [4, 5] },
    },

    // Quiet zones: a soft yellow wash with a dashed glowing edge. Out of season they go pale.
    {
      id: "quiet-fill",
      type: "fill",
      source: SOURCE,
      filter: all(POLY, cat("quiet_zones")),
      paint: { "fill-color": COLORS.quiet, "fill-opacity": ["case", DIM, 0.015, INACTIVE, 0.025, HOVER, 0.16, 0.08] },
    },
    {
      id: "quiet-glow",
      type: "line",
      source: SOURCE,
      filter: all(POLY, cat("quiet_zones")),
      paint: { "line-color": COLORS.quiet, "line-width": zoomed(3, 10), "line-blur": zoomed(2, 8), "line-opacity": ["case", DIM, 0.03, INACTIVE, 0.06, 0.26] },
    },
    {
      id: "quiet-line",
      type: "line",
      source: SOURCE,
      filter: all(POLY, cat("quiet_zones")),
      paint: {
        "line-color": ["case", INACTIVE, "#8f8a5a", COLORS.quiet],
        "line-width": zoomed(0.8, 2),
        "line-dasharray": [3, 2.5],
        "line-opacity": ["case", DIM, 0.12, INACTIVE, 0.6, 0.95],
      },
    },

    // Agreed zones (fixes drawn as areas).
    { id: "fix-fill", type: "fill", source: SOURCE, filter: all(POLY, cat("fixes")), paint: { "fill-color": COLORS.fix, "fill-opacity": ["case", DIM, 0.04, HOVER, 0.32, 0.18] } },
    { id: "fix-line", type: "line", source: SOURCE, filter: all(POLY, cat("fixes")), paint: { "line-color": COLORS.fix, "line-width": zoomed(1, 2.5), "line-opacity": fade(1, 0.2) } },

    // Buildings: a glowing footprint, dark glass blocks, and a lit roof edge.
    {
      id: "building-glow",
      type: "line",
      source: SOURCE,
      filter: all(POLY, is("layer", "building")),
      paint: { "line-color": COLORS.buildingTop, "line-width": zoomed(3, 14), "line-blur": zoomed(3, 12), "line-opacity": 0.3 },
    },
    {
      id: "building",
      type: "fill-extrusion",
      source: SOURCE,
      filter: all(POLY, is("layer", "building")),
      paint: {
        "fill-extrusion-color": ["case", HOVER, "#14574a", "#0a3a2e"],
        "fill-extrusion-height": HEIGHT,
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.93,
        "fill-extrusion-vertical-gradient": true,
      },
    },
    {
      // A thin lit band around each roof edge: the neon outline of the building.
      id: "roof-rim",
      type: "fill-extrusion",
      source: SOURCE,
      filter: all(is("_cat", "rim")),
      paint: {
        "fill-extrusion-color": COLORS.buildingTop,
        "fill-extrusion-base": ["-", HEIGHT, 0.7],
        "fill-extrusion-height": ["+", HEIGHT, 0.25],
        "fill-extrusion-opacity": 0.95,
      },
    },
    {
      id: "green-roof",
      type: "fill-extrusion",
      source: SOURCE,
      filter: all(POLY, is("habitat", "green_roof")),
      paint: {
        "fill-extrusion-color": ["case", HOVER, "#2bd476", "#178a4c"],
        "fill-extrusion-base": ["+", ["coalesce", get("height_m"), 18], 0.3],
        "fill-extrusion-height": ["+", ["coalesce", get("height_m"), 18], 1.2],
        "fill-extrusion-opacity": 0.92,
      },
    },

    // Things a plan adds glow violet.
    {
      id: "new-glow",
      type: "line",
      source: SOURCE,
      filter: all(is("_new", 1)),
      layout: ROUND,
      paint: { "line-color": COLORS.fix, "line-width": zoomed(6, 24), "line-blur": zoomed(4, 16), "line-opacity": fade(0.6, 0.1) },
    },

    // Routes: a soft glow under a crisp line, each kind with its own pattern.
    {
      id: "route-glow",
      type: "line",
      source: SOURCE,
      filter: all(LINE, cat(...ROUTE_CATS)),
      layout: ROUND,
      paint: { "line-color": CAT_COLOR, "line-width": zoomed(4, 18), "line-blur": zoomed(3, 13), "line-opacity": ["case", DIM, 0.03, HOVER, 0.8, 0.36] },
    },
    { id: "people-line", type: "line", source: SOURCE, filter: all(LINE, cat("people_routes")), layout: ROUND, paint: { "line-color": COLORS.people, "line-width": zoomed(1.3, 4), "line-opacity": fade(1, 0.18) } },
    {
      id: "animal-line",
      type: "line",
      source: SOURCE,
      filter: all(LINE, cat("animal_paths")),
      layout: ROUND,
      paint: { "line-color": COLORS.animals, "line-width": zoomed(2, 5.5), "line-dasharray": [0.01, 2.2], "line-opacity": fade(0.8, 0.15) },
    },
    {
      id: "delivery-line",
      type: "line",
      source: SOURCE,
      filter: all(LINE, cat("deliveries")),
      paint: { "line-color": COLORS.delivery, "line-width": zoomed(1, 2.6), "line-dasharray": [3, 2.4], "line-opacity": fade(0.85, 0.15) },
    },
    { id: "barrier-line", type: "line", source: SOURCE, filter: all(LINE, cat("fixes")), layout: ROUND, paint: { "line-color": COLORS.fix, "line-width": zoomed(2.5, 7), "line-opacity": fade(1, 0.2) } },

    // The selection gets a white halo.
    {
      id: "sel-glow",
      type: "line",
      source: SOURCE,
      filter: all(is("_sel", 1)),
      layout: ROUND,
      paint: { "line-color": "#ffffff", "line-width": zoomed(6, 22), "line-blur": zoomed(4, 14), "line-opacity": 0.45 },
    },
    { id: "sel-line", type: "line", source: SOURCE, filter: all(is("_sel", 1)), layout: ROUND, paint: { "line-color": "#effff8", "line-width": zoomed(1, 2.6) } },

    // Moving lights: animals, couriers and people travelling along their routes.
    {
      id: "flow-glow",
      type: "circle",
      source: FLOW_SOURCE,
      paint: { "circle-color": CAT_COLOR, "circle-radius": zoomed(5, 15), "circle-blur": 0.9, "circle-opacity": fade(1, 0.1) },
    },
    { id: "flow-core", type: "circle", source: FLOW_SOURCE, paint: { "circle-color": "#fffbea", "circle-radius": zoomed(1.5, 3.6), "circle-blur": 0.3, "circle-opacity": fade(1, 0.1) } },
  ];

  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
      grid: { type: "geojson", data: gridLines() },
      [SOURCE]: { type: "geojson", data: EMPTY, promoteId: "_id" },
      [FLOW_SOURCE]: { type: "geojson", data: EMPTY },
    },
    light: { anchor: "map", color: "#c8ffe6", intensity: 0.28, position: [1.3, 200, 34] },
    layers,
  };
}

// --- data -------------------------------------------------------------------------------

/** A route that has little lights moving along it. */
interface Flow {
  coords: LonLat[];
  /** Distance in metres from the start to each vertex. */
  along: number[];
  length: number;
  cat: CategoryKey;
  dim: boolean;
  count: number;
  speed: number;
  seed: number;
}

interface PointItem {
  feature: MapFeature;
  dim: boolean;
}

const FLOW_SPEED: Partial<Record<CategoryKey, number>> = { animal_paths: 16, deliveries: 24, people_routes: 10 };

function metres(a: LonLat, b: LonLat): number {
  const dx = (b[0] - a[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180);
  const dy = (b[1] - a[1]) * 110_540;
  return Math.hypot(dx, dy);
}

function makeFlow(coords: LonLat[], cat: CategoryKey, dim: boolean, seed: number): Flow | null {
  if (coords.length < 2) return null;
  const along = [0];
  for (let i = 1; i < coords.length; i++) along.push(along[i - 1] + metres(coords[i - 1], coords[i]));
  const length = along[along.length - 1];
  if (length < 5) return null;
  const count = cat === "people_routes" ? 1 : Math.min(4, Math.max(1, Math.round(length / 110)));
  return { coords, along, length, cat, dim, count, speed: FLOW_SPEED[cat] ?? 12, seed };
}

function positionOn(flow: Flow, distance: number): LonLat {
  const d = ((distance % flow.length) + flow.length) % flow.length;
  let i = 1;
  while (i < flow.along.length - 1 && flow.along[i] < d) i++;
  const start = flow.along[i - 1];
  const t = (d - start) / (flow.along[i] - start || 1);
  const a = flow.coords[i - 1];
  const b = flow.coords[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function flowPoints(flows: Flow[], seconds: number): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const flow of flows) {
    for (let k = 0; k < flow.count; k++) {
      const distance = seconds * flow.speed + (k * flow.length) / flow.count + flow.seed;
      features.push({ type: "Feature", properties: { _cat: flow.cat, _dim: flow.dim ? 1 : 0 }, geometry: { type: "Point", coordinates: positionOn(flow, distance) } });
    }
  }
  return { type: "FeatureCollection", features };
}

/** A ring just inside each building outline, extruded at roof height as a glowing edge. */
function roofRims(feature: MapFeature): Feature[] {
  return polygonsOf(feature.geometry).map((rings, i) => {
    const outer = rings[0].map(([lat, lon]) => [lon, lat] as LonLat);
    const corners = outer.slice(0, -1);
    const c: LonLat = [corners.reduce((sum, p) => sum + p[0], 0) / corners.length, corners.reduce((sum, p) => sum + p[1], 0) / corners.length];
    const radius = corners.reduce((sum, p) => sum + metres(c, p), 0) / corners.length;
    const k = Math.min(0.97, Math.max(0.6, 1 - 1.6 / radius));
    const inner = outer.map(([lon, lat]) => [c[0] + (lon - c[0]) * k, c[1] + (lat - c[1]) * k] as LonLat).reverse();
    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [outer, inner] },
      properties: { _id: `${feature.id}-rim-${i}`, _cat: "rim", height_m: feature.properties.height_m ?? 10 },
    } as Feature;
  });
}

function derive(features: MapFeature[], visible: Set<CategoryKey>, relatedIds: Set<string> | null, selectedId: string | null) {
  const shapes: Feature[] = [];
  const points: PointItem[] = [];
  const flows: Flow[] = [];
  features.forEach((f, index) => {
    const category = categoryOf(f.properties);
    // Hidden categories still show the features linked to the selection (e.g. the fox's path).
    if (!category || (!visible.has(category) && !relatedIds?.has(f.id))) return;
    const dim = relatedIds !== null && !relatedIds.has(f.id) && !NOT_DIMMED.includes(category);
    if (f.geometry.type === "Point") {
      points.push({ feature: f, dim });
      return;
    }
    shapes.push({
      type: "Feature",
      geometry: f.geometry,
      properties: {
        ...f.properties,
        _id: f.id,
        _cat: category,
        _dim: dim ? 1 : 0,
        _sel: f.id === selectedId ? 1 : 0,
        _new: f.properties.scenario_role === "proposed" ? 1 : 0,
      },
    });
    if (f.properties.layer === "building") shapes.push(...roofRims(f));
    const movesHere = category === "animal_paths" || category === "deliveries" || (category === "people_routes" && f.properties.kind !== "street");
    if (movesHere) {
      for (const line of linesOf(f.geometry)) {
        const flow = makeFlow(line.map(([lat, lon]) => [lon, lat] as LonLat), category, dim, index * 37);
        if (flow) flows.push(flow);
      }
    }
  });
  return { shapes: { type: "FeatureCollection", features: shapes } as FeatureCollection, points, flows };
}

function lonLatOf(feature: MapFeature): LonLat | null {
  const point = pointOf(feature.geometry);
  return point ? [point[1], point[0]] : null;
}

function boundsFor(features: MapFeature[]): LngLatBounds | null {
  const b = boundsOf(features);
  return b ? new LngLatBounds([b[0][1], b[0][0]], [b[1][1], b[1][0]]) : null;
}

function markerScale(zoom: number): string {
  return Math.min(1.25, Math.max(0.68, 0.9 + (zoom - 17) * 0.14)).toFixed(2);
}

interface MarkerEntry {
  marker: Marker;
  html: string;
}

// --- component --------------------------------------------------------------------------

/** The neighborhood map: a dark neon 3D city drawn from the dataset with MapLibre GL. */
export default function NeighborhoodMap({
  features,
  visible,
  selectedId,
  relatedIds,
  playingId,
  showRealMap,
  onSelect,
  focus,
  padding = DEFAULT_PADDING,
  detailsInset = NO_INSET,
  fitKey = "initial",
  scrollWheelZoom = true,
  initialCenter,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new Map<string, MarkerEntry>());
  const popupRef = useRef<Popup | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const fittedRef = useRef<string | null>(null);
  const focusRef = useRef<number | null>(null);
  const [loaded, setLoaded] = useState<MapLibreMap | null>(null);

  // Event handlers read the latest props through refs, so the map is built only once.
  const latest = useRef({ onSelect, features, initialCenter, scrollWheelZoom });
  useEffect(() => {
    latest.current = { onSelect, features, initialCenter, scrollWheelZoom };
  });

  const derived = useMemo(() => derive(features, visible, relatedIds, selectedId), [features, visible, relatedIds, selectedId]);

  // Build the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const start = latest.current.initialCenter;
    const map = new MapLibreMap({
      container,
      style: buildStyle(),
      center: start ? [start[1], start[0]] : CENTER,
      zoom: start ? 17.6 : 16.6,
      minZoom: 15,
      maxZoom: 20,
      maxPitch: 70,
      maxBounds: [
        [AREA.west - 0.004, AREA.south - 0.003],
        [AREA.east + 0.004, AREA.north + 0.003],
      ],
      scrollZoom: latest.current.scrollWheelZoom,
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
      fadeDuration: 0,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-left");
    popupRef.current = new Popup({ closeButton: false, closeOnClick: false, closeOnMove: false, className: "kin-pop", offset: 14, maxWidth: "240px" });
    container.style.setProperty("--kin-scale", markerScale(map.getZoom()));

    const findFeature = (id: unknown) => latest.current.features.find((f) => f.id === id) ?? null;
    const fromMarker = (e: MapMouseEvent) => (e.originalEvent.target as HTMLElement | null)?.closest?.(".maplibregl-marker") != null;
    const pick = (e: MapMouseEvent, radius: number) => {
      const layers = INTERACTIVE.filter((id) => map.getLayer(id));
      const box: [[number, number], [number, number]] = [
        [e.point.x - radius, e.point.y - radius],
        [e.point.x + radius, e.point.y + radius],
      ];
      return map.queryRenderedFeatures(box, { layers })[0] ?? null;
    };
    const setHover = (id: string | null) => {
      if (hoveredRef.current === id) return;
      if (hoveredRef.current) map.setFeatureState({ source: SOURCE, id: hoveredRef.current }, { hover: false });
      hoveredRef.current = id;
      if (id) map.setFeatureState({ source: SOURCE, id }, { hover: true });
    };

    map.on("load", () => setLoaded(map));
    // "Real Brussels" tiles need internet; when they fail the city simply stays on its own.
    map.on("error", (e) => {
      if ((e as { sourceId?: string }).sourceId !== "osm") console.error(e.error);
    });
    map.on("click", (e) => {
      if (fromMarker(e)) return;
      const hit = pick(e, 5);
      latest.current.onSelect(hit ? findFeature(hit.properties._id) : null);
    });
    map.on("mousemove", (e) => {
      if (fromMarker(e)) return;
      const hit = pick(e, 4);
      const id = hit ? String(hit.properties._id) : null;
      setHover(id);
      map.getCanvas().style.cursor = id ? "pointer" : "";
      const popup = popupRef.current;
      if (!popup) return;
      if (hit) popup.setLngLat(e.lngLat).setText(tidy(String(hit.properties.name ?? ""))).setOffset(14).addTo(map);
      else popup.remove();
    });
    map.on("mouseout", () => {
      setHover(null);
      popupRef.current?.remove();
    });
    map.on("zoom", () => container.style.setProperty("--kin-scale", markerScale(map.getZoom())));

    const markers = markersRef.current;
    return () => {
      markers.clear();
      popupRef.current = null;
      hoveredRef.current = null;
      fittedRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // Shapes: redraw when the data, the visible categories or the selection change.
  useEffect(() => {
    if (!loaded || loaded !== mapRef.current) return;
    (loaded.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(derived.shapes);
  }, [loaded, derived.shapes]);

  // Moving lights along the routes.
  useEffect(() => {
    const map = loaded;
    if (!map || map !== mapRef.current) return;
    const source = map.getSource(FLOW_SOURCE) as GeoJSONSource | undefined;
    if (!source) return;
    if (!derived.flows.length) {
      source.setData(EMPTY);
      return;
    }
    if (reducedMotion()) {
      source.setData(flowPoints(derived.flows, 0));
      return;
    }
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < 40) return; // about 25 updates a second is plenty
      last = now;
      source.setData(flowPoints(derived.flows, now / 1000));
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loaded, derived.flows]);

  // Points are HTML markers, so they stay sharp and can be focused with the keyboard.
  useEffect(() => {
    const map = loaded;
    if (!map || map !== mapRef.current) return;
    const markers = markersRef.current;
    const seen = new Set<string>();
    for (const { feature, dim } of derived.points) {
      const p = feature.properties;
      const at = lonLatOf(feature);
      const selected = feature.id === selectedId;
      const look = markerLook(p, { selected, dimmed: dim, playing: feature.id === playingId, isNew: p.scenario_role === "proposed" });
      if (!at || !look) continue;
      seen.add(feature.id);
      let entry = markers.get(feature.id);
      if (!entry) {
        const el = document.createElement("div");
        el.className = "kin-marker";
        el.tabIndex = 0;
        el.setAttribute("role", "button");
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const current = latest.current.features.find((f) => f.id === feature.id);
          if (current) latest.current.onSelect(current);
        });
        el.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          const current = latest.current.features.find((f) => f.id === feature.id);
          if (current) latest.current.onSelect(current);
        });
        el.addEventListener("pointerenter", (e) => {
          if (e.pointerType !== "mouse") return;
          const current = latest.current.features.find((f) => f.id === feature.id);
          const popup = popupRef.current;
          if (!current || !popup || !entry) return;
          const lift = el.querySelector(".kin-animal") ? 46 : 18;
          popup.setLngLat(entry.marker.getLngLat()).setOffset([0, -lift]).setText(tidy(current.properties.name)).addTo(map);
        });
        el.addEventListener("pointerleave", () => popupRef.current?.remove());
        entry = { marker: new Marker({ element: el, anchor: look.anchor }).setLngLat(at).addTo(map), html: "" };
        markers.set(feature.id, entry);
      } else {
        entry.marker.setLngLat(at);
      }
      const el = entry.marker.getElement();
      if (entry.html !== look.html) {
        el.innerHTML = look.html;
        entry.html = look.html;
      }
      el.style.zIndex = String(look.z + (selected ? 100 : 0));
      el.setAttribute("aria-label", `${tidy(p.name)}, ${typeLabel(p)}${p.layer === "wildlife" ? ", play sound" : ""}`);
      el.setAttribute("aria-pressed", String(selected));
    }
    for (const [id, entry] of markers) {
      if (!seen.has(id)) {
        entry.marker.remove();
        markers.delete(id);
      }
    }
  }, [loaded, derived.points, selectedId, playingId]);

  // Real Brussels under the invented city.
  useEffect(() => {
    if (!loaded || loaded !== mapRef.current) return;
    loaded.setLayoutProperty("osm", "visibility", showRealMap ? "visible" : "none");
  }, [loaded, showRealMap]);

  // Fit the neighborhood when the data arrives (and again when `fitKey` changes).
  useEffect(() => {
    const map = loaded;
    if (!map || map !== mapRef.current || !features.length || fittedRef.current === fitKey) return;
    const first = fittedRef.current === null;
    fittedRef.current = fitKey;
    const calm = reducedMotion();
    if (initialCenter) {
      map.easeTo({ center: [initialCenter[1], initialCenter[0]], zoom: 17.6, ...TILT, duration: calm ? 0 : 1400 });
      return;
    }
    const bounds = boundsFor(features.filter((f) => categoryOf(f.properties) !== "city" || f.properties.layer === "building"));
    if (!bounds) return;
    const pad = { top: padding.topLeft[1], left: padding.topLeft[0], right: padding.bottomRight[0], bottom: padding.bottomRight[1] };
    const fit = map.cameraForBounds(bounds, { padding: pad, bearing: TILT.bearing });
    if (!fit) return;
    // The fit is worked out flat; the tilted view shrinks the far side, so it can come a little closer.
    const camera = { ...fit, ...TILT, zoom: (fit.zoom ?? 17) + 0.3 };
    if (first && !calm) {
      // Start flat and lift into the tilted 3D view.
      map.jumpTo({ ...camera, pitch: 0, bearing: 0, zoom: camera.zoom - 0.5 });
      map.easeTo({ ...camera, duration: 2200 });
    } else {
      map.easeTo({ ...camera, duration: calm ? 0 : 900 });
    }
  }, [loaded, features, fitKey, initialCenter, padding]);

  // Camera for the selection: fly to a feature when the page asks for it ("show the fox den"),
  // and otherwise make sure a clicked feature is not hidden behind the details card.
  useEffect(() => {
    const map = loaded;
    if (!map || map !== mapRef.current) return;
    const container = map.getContainer();
    const width = container.clientWidth;
    const height = container.clientHeight;
    const left = padding.topLeft[0];
    const top = padding.topLeft[1];
    const right = Math.max(padding.bottomRight[0], detailsInset.right);
    const bottom = Math.max(padding.bottomRight[1], detailsInset.bottom);
    const calm = reducedMotion();

    if (focus && focusRef.current !== focus.nonce) {
      focusRef.current = focus.nonce;
      const feature = features.find((f) => f.id === focus.id);
      if (!feature) return;
      const at = lonLatOf(feature);
      if (at) {
        // Land the point in the middle of the free part of the map, not under a panel.
        map.flyTo({ center: at, zoom: Math.max(map.getZoom(), 18), offset: [(left - right) / 2, (top - bottom) / 2], duration: calm ? 0 : 900 });
      } else {
        const bounds = boundsFor([feature]);
        if (bounds) map.fitBounds(bounds, { padding: { top, left, right, bottom }, maxZoom: 18.5, duration: calm ? 0 : 900 });
      }
      return;
    }

    const feature = selectedId ? features.find((f) => f.id === selectedId) : undefined;
    const at = feature && lonLatOf(feature);
    if (!at) return;
    // If the clicked point is near an edge or under a panel, slide it into the free area.
    const p = map.project(at);
    const margin = 56;
    const free = { x1: Math.min(left, width / 3), y1: top, x2: width - right, y2: height - bottom };
    if (p.x < free.x1 + margin || p.x > free.x2 - margin || p.y < free.y1 + margin || p.y > free.y2 - margin) {
      map.panBy([p.x - (free.x1 + free.x2) / 2, p.y - (free.y1 + free.y2) / 2], { duration: calm ? 0 : 500 });
    }
    // Only react to a new selection or request, not to every data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, focus?.nonce, selectedId]);

  return <div ref={containerRef} className={`kin-map h-full w-full ${className}`} />;
}
