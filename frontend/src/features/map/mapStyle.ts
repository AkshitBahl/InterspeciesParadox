import type { MapFeatureProps } from "./mapData";

/**
 * Neon on a dark green city. Each meaning keeps one colour and its own shape or line pattern:
 *   cyan people · orange animals · amber homes · green nature · teal water
 *   yellow quiet zones · red conflicts · violet fixes and plans · mint city
 */
export const COLORS = {
  ground: "#03140f",
  grid: "#0c3326",
  people: "#4cc9ff",
  animals: "#ff8a3d",
  home: "#ffc24b",
  place: "#9fe8c8",
  delivery: "#d7e3dd",
  conflict: "#ff3b5c",
  fix: "#b388ff",
  nature: "#39ff88",
  natureFill: "#0b3d26",
  water: "#2de2ff",
  waterFill: "#05303a",
  quiet: "#ffe14d",
  street: "#0c2a21",
  streetLight: "#1fd68a",
  building: "#0f3a2d",
  buildingTop: "#3dffb0",
} as const;

export type CategoryKey =
  | "people"
  | "animals"
  | "homes"
  | "people_routes"
  | "animal_paths"
  | "deliveries"
  | "nature"
  | "quiet_zones"
  | "conflicts"
  | "fixes"
  | "places"
  | "entrances"
  | "city";

export type SwatchKind = "person" | "animal" | "home" | "place" | "entrance" | "conflict" | "fix" | "line" | "zone";

export interface Category {
  key: CategoryKey;
  label: string;
  color: string;
  swatch: SwatchKind;
  /** Line pattern (SVG dash array) for routes and zone outlines. */
  dash?: string;
  fill?: string;
}

export interface CategoryGroup {
  title: string;
  categories: Category[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    title: "Living here",
    categories: [
      { key: "people", label: "People", color: COLORS.people, swatch: "person" },
      { key: "animals", label: "Animals", color: COLORS.animals, swatch: "animal" },
      { key: "homes", label: "Animal homes", color: COLORS.home, swatch: "home" },
    ],
  },
  {
    title: "Moving",
    categories: [
      { key: "people_routes", label: "People routes", color: COLORS.people, swatch: "line" },
      { key: "animal_paths", label: "Animal paths", color: COLORS.animals, swatch: "line", dash: "1 6" },
      { key: "deliveries", label: "Deliveries", color: COLORS.delivery, swatch: "line", dash: "6 5" },
    ],
  },
  {
    title: "Zones",
    categories: [
      { key: "nature", label: "Nature", color: COLORS.nature, fill: COLORS.natureFill, swatch: "zone" },
      { key: "quiet_zones", label: "Quiet zones", color: COLORS.quiet, fill: "#3a3410", swatch: "zone", dash: "4 3" },
    ],
  },
  {
    title: "Issues",
    categories: [
      { key: "conflicts", label: "Conflicts", color: COLORS.conflict, swatch: "conflict" },
      { key: "fixes", label: "Fixes", color: COLORS.fix, swatch: "fix" },
    ],
  },
  {
    title: "City",
    categories: [
      { key: "places", label: "Places", color: COLORS.place, swatch: "place" },
      { key: "entrances", label: "Doors", color: COLORS.place, swatch: "entrance" },
      { key: "city", label: "Streets", color: COLORS.buildingTop, fill: COLORS.building, swatch: "zone" },
    ],
  },
];

export const CATEGORIES: Record<CategoryKey, Category> = Object.fromEntries(
  CATEGORY_GROUPS.flatMap((g) => g.categories).map((c) => [c.key, c])
) as Record<CategoryKey, Category>;

export const ALL_CATEGORIES = Object.keys(CATEGORIES) as CategoryKey[];

export function categoryOf(p: MapFeatureProps): CategoryKey | null {
  switch (p.layer) {
    case "resident":
      return "people";
    case "wildlife":
      return "animals";
    case "wildlife_site":
      return "homes";
    case "human_route":
      return p.kind === "street" ? "city" : "people_routes";
    case "wildlife_corridor":
      return "animal_paths";
    case "delivery_route":
      return "deliveries";
    case "habitat_zone":
      return "nature";
    case "ecological_buffer":
      return "quiet_zones";
    case "conflict_hotspot":
      return "conflicts";
    case "intervention":
    case "barrier":
    case "agreed_zone":
      return "fixes";
    case "point_of_interest":
      return "places";
    case "entrance":
      return "entrances";
    case "building":
      return "city";
    default:
      return null;
  }
}

/** Quick views, so a first visit shows one story at a time. */
export interface FocusView {
  key: string;
  label: string;
  categories: CategoryKey[];
}

export const FOCUS_VIEWS: FocusView[] = [
  {
    key: "overview",
    label: "Overview",
    // Calm first view: who lives where and where the problems are.
    categories: ["people", "animals", "homes", "people_routes", "nature", "quiet_zones", "conflicts", "fixes", "places", "city"],
  },
  { key: "people", label: "People", categories: ["people", "people_routes", "deliveries", "places", "entrances", "city"] },
  { key: "animals", label: "Animals", categories: ["animals", "homes", "animal_paths", "nature", "quiet_zones", "city"] },
  { key: "conflicts", label: "Conflicts", categories: ["conflicts", "fixes", "people", "animals", "quiet_zones", "city"] },
  { key: "everything", label: "All", categories: ALL_CATEGORIES },
];

const ROLE_WORDS: Record<string, string> = {
  resident: "Resident",
  owner: "Owner",
  technician: "Technician",
  courier: "Courier",
};

/** One or two words for what a feature is. */
export function typeLabel(p: MapFeatureProps): string {
  const species = p.species_name ? ` · ${p.species_name}` : "";
  const isNew = p.scenario_role === "proposed";
  switch (p.layer) {
    case "resident":
      return ROLE_WORDS[p.role ?? ""] ?? "Neighbor";
    case "wildlife":
      return p.species_name ?? "Animal";
    case "wildlife_site":
      return `Home${species}`;
    case "human_route":
      return p.kind === "street" ? "Street" : "Daily route";
    case "wildlife_corridor":
      return `Path${species}`;
    case "delivery_route":
      return "Delivery route";
    case "habitat_zone":
      return p.habitat === "wetland" ? "Pond" : "Nature";
    case "ecological_buffer":
      return `Quiet zone${species}`;
    case "conflict_hotspot":
      return `Conflict${species}`;
    case "intervention":
    case "barrier":
    case "agreed_zone":
      return isNew ? "New fix" : "Agreed fix";
    case "point_of_interest":
      return "Place";
    case "entrance":
      return "Door";
    case "building":
      return "Building";
    default:
      return p.layer.replace(/_/g, " ");
  }
}
