import type { Geometry } from "geojson";
import { liveRequest } from "../../services/live/client";

/** Properties the backend puts on every map feature (GET /api/v1/map/features). */
export interface MapFeatureProps {
  layer: string;
  name: string;
  description?: string | null;
  emoji?: string;
  species_slug?: string | null;
  species_name?: string | null;
  kind?: string;
  role?: string;
  note?: string;
  count?: number;
  representative?: string;
  lighting?: string;
  step_free?: boolean;
  height_m?: number;
  severity?: number;
  category?: string;
  site_type?: string;
  habitat?: string;
  active_months?: number[] | null;
  active_now?: boolean;
  status?: string;
  scenario_role?: string;
  conflict_id?: string | null;
  [key: string]: unknown;
}

export interface MapFeature {
  type: "Feature";
  id: string;
  geometry: Geometry;
  properties: MapFeatureProps;
}

export interface MapCollection {
  type: "FeatureCollection";
  features: MapFeature[];
  metadata?: Record<string, unknown>;
}

export type DataSource = "live" | "offline";

export interface NeighborhoodData {
  today: MapFeature[];
  /** The map with one plan applied (only when a plan is chosen). */
  plan: MapFeature[] | null;
  planTitle: string | null;
  source: DataSource;
}

const SNAPSHOT_URL = `${import.meta.env.BASE_URL}data/ixelles-ponds-2126.geojson`;

function withIds(collection: MapCollection): MapFeature[] {
  return collection.features.map((f, index) => ({ ...f, id: String(f.id ?? f.properties?.id ?? `feature-${index}`) }));
}

async function loadSnapshot(): Promise<MapFeature[]> {
  const response = await fetch(SNAPSHOT_URL);
  if (!response.ok) throw new Error("The offline copy of the neighborhood could not be loaded.");
  return withIds((await response.json()) as MapCollection);
}

/**
 * Loads the neighborhood. Live mode reads the backend; if the backend is not
 * running (or in mock mode) it falls back to the bundled copy of the same dataset.
 */
export async function loadNeighborhood(useBackend: boolean, solutionId: string | null): Promise<NeighborhoodData> {
  if (useBackend) {
    try {
      const [today, plan] = await Promise.all([
        liveRequest<MapCollection>("/map/features", { anonymous: true }),
        solutionId ? liveRequest<MapCollection>(`/map/scenarios/${encodeURIComponent(solutionId)}`, { anonymous: true }) : null,
      ]);
      return {
        today: withIds(today),
        plan: plan ? withIds(plan) : null,
        planTitle: plan ? String(plan.metadata?.solution_title ?? "Proposed plan") : null,
        source: "live",
      };
    } catch {
      // Backend not reachable: show the offline copy instead of an empty page.
    }
  }
  return { today: await loadSnapshot(), plan: null, planTitle: null, source: "offline" };
}

// --- geometry helpers (GeoJSON is [lon, lat], Leaflet is [lat, lon]) ----------------

export type LatLng = [number, number];

export function pointOf(geometry: Geometry): LatLng | null {
  if (geometry.type !== "Point") return null;
  const [lon, lat] = geometry.coordinates;
  return [lat, lon];
}

export function linesOf(geometry: Geometry): LatLng[][] {
  if (geometry.type === "LineString") return [geometry.coordinates.map(([lon, lat]) => [lat, lon] as LatLng)];
  if (geometry.type === "MultiLineString") return geometry.coordinates.map((line) => line.map(([lon, lat]) => [lat, lon] as LatLng));
  return [];
}

/** Polygon rings (outer ring first). MultiPolygons become several polygons. */
export function polygonsOf(geometry: Geometry): LatLng[][][] {
  const ring = (coords: number[][]) => coords.map(([lon, lat]) => [lat, lon] as LatLng);
  if (geometry.type === "Polygon") return [geometry.coordinates.map(ring)];
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map((polygon) => polygon.map(ring));
  return [];
}

function allCoordinates(geometry: Geometry): LatLng[] {
  const point = pointOf(geometry);
  if (point) return [point];
  const lines = linesOf(geometry);
  if (lines.length) return lines.flat();
  return polygonsOf(geometry).flat(2);
}

/** [[south, west], [north, east]] of one or more features. */
export function boundsOf(features: MapFeature[]): [LatLng, LatLng] | null {
  const coords = features.flatMap((f) => allCoordinates(f.geometry));
  if (!coords.length) return null;
  const lats = coords.map((c) => c[0]);
  const lons = coords.map((c) => c[1]);
  return [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ];
}

/** Moves a polygon a few metres (used to draw soft building shadows). */
export function shiftRings(rings: LatLng[][], metresEast: number, metresNorth: number): LatLng[][] {
  return rings.map((r) =>
    r.map(([lat, lon]) => [lat + metresNorth / 111_320, lon + metresEast / (111_320 * Math.cos((lat * Math.PI) / 180))] as LatLng)
  );
}

// --- plain-language text ----------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** [5,6,7,8,11,12,1,2,3] -> "Nov–Mar, May–Aug" */
export function monthRanges(months: number[] | null | undefined): string {
  if (!months?.length) return "all year";
  const on = Array.from({ length: 12 }, (_, i) => months.includes(i + 1));
  if (on.every(Boolean)) return "all year";
  const start = on.findIndex((v, i) => v && !on[(i + 11) % 12]);
  const ranges: string[] = [];
  for (let step = 0; step < 12; step++) {
    const i = (start + step) % 12;
    if (on[i] && !on[(i + 11) % 12]) {
      let end = i;
      while (on[(end + 1) % 12] && (end + 1) % 12 !== i) end = (end + 1) % 12;
      ranges.push(end === i ? MONTHS[i] : `${MONTHS[i]}–${MONTHS[end]}`);
    }
  }
  return ranges.join(", ");
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
