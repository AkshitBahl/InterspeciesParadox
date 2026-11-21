import type { MapFeatureProps } from "./mapData";

/**
 * One visual language for the whole map:
 *   blue = people · orange = animals · brown = animal homes · green = nature
 *   yellow = quiet zones · red = conflicts · purple = fixes and plans · grey = the city
 * Every category also has its own shape or line pattern, so colour is never the only clue.
 */
export const COLORS = {
  people: "#2563EB",
  animals: "#EA6A1E",
  home: "#8B5A2B",
  place: "#475569",
  delivery: "#475569",
  conflict: "#DC2626",
  fix: "#7C3AED",
  nature: "#3F9A55",
  natureFill: "#A7D9A9",
  water: "#9FD0E4",
  quiet: "#D97706",
  quietFill: "#FCD34D",
  street: "#FFFFFF",
  streetCasing: "#D8D1C1",
  building: "#E9E3D5",
  buildingEdge: "#BFB49E",
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
  hint: string;
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
    title: "Who lives here",
    categories: [
      { key: "people", label: "People", hint: "Residents, workers, couriers.", color: COLORS.people, swatch: "person" },
      { key: "animals", label: "Animals", hint: "Tap one to hear it.", color: COLORS.animals, swatch: "animal" },
      { key: "homes", label: "Animal homes", hint: "Nests, dens and roosts.", color: COLORS.home, swatch: "home" },
    ],
  },
  {
    title: "How they move",
    categories: [
      { key: "people_routes", label: "People's daily routes", hint: "Commutes and school runs.", color: COLORS.people, swatch: "line" },
      { key: "animal_paths", label: "Animal paths", hint: "Where animals fly or crawl.", color: COLORS.animals, swatch: "line", dash: "1 7" },
      { key: "deliveries", label: "Delivery routes", hint: "Cargo bikes and robots.", color: COLORS.delivery, swatch: "line", dash: "8 6" },
    ],
  },
  {
    title: "Zones",
    categories: [
      { key: "nature", label: "Nature areas", hint: "Green spaces and the pond.", color: COLORS.nature, fill: COLORS.natureFill, swatch: "zone" },
      { key: "quiet_zones", label: "Wildlife quiet zones", hint: "Keep away in nesting months.", color: COLORS.quiet, fill: COLORS.quietFill, swatch: "zone", dash: "5 4" },
    ],
  },
  {
    title: "Problems and fixes",
    categories: [
      { key: "conflicts", label: "Conflicts", hint: "A person and an animal clash.", color: COLORS.conflict, swatch: "conflict" },
      { key: "fixes", label: "Agreed fixes", hint: "Agreed by both sides.", color: COLORS.fix, swatch: "fix" },
    ],
  },
  {
    title: "The city",
    categories: [
      { key: "places", label: "Places", hint: "Tram, playground, solar roofs.", color: COLORS.place, swatch: "place" },
      { key: "entrances", label: "Building entrances", hint: "Doors and delivery docks.", color: COLORS.place, swatch: "entrance" },
      { key: "city", label: "Streets and buildings", hint: "The map background.", color: COLORS.buildingEdge, fill: COLORS.building, swatch: "zone" },
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

/** Quick views, so a first-time visitor can look at one story at a time. */
export interface FocusView {
  key: string;
  label: string;
  categories: CategoryKey[];
}

export const FOCUS_VIEWS: FocusView[] = [
  {
    key: "overview",
    label: "Overview",
    // Calm first view: who lives where, and where the problems are. Routes come with the other views.
    categories: ["people", "animals", "homes", "people_routes", "nature", "quiet_zones", "conflicts", "fixes", "places", "city"],
  },
  { key: "people", label: "People", categories: ["people", "people_routes", "deliveries", "places", "entrances", "city"] },
  { key: "animals", label: "Animals", categories: ["animals", "homes", "animal_paths", "nature", "quiet_zones", "city"] },
  { key: "conflicts", label: "Conflicts & fixes", categories: ["conflicts", "fixes", "people", "animals", "quiet_zones", "city"] },
  { key: "everything", label: "Everything", categories: ALL_CATEGORIES },
];

const ROLE_WORDS: Record<string, string> = {
  resident: "Resident",
  owner: "Building owner",
  technician: "Technician",
  courier: "Courier",
};

/** A short, plain description of what a feature is. */
export function typeLabel(p: MapFeatureProps): string {
  const species = p.species_name ? ` · ${p.species_name}` : "";
  switch (p.layer) {
    case "resident":
      return `Person · ${ROLE_WORDS[p.role ?? ""] ?? "Neighbor"}`;
    case "wildlife":
      return `Animal${species}`;
    case "wildlife_site":
      return `Animal home${species}`;
    case "human_route":
      return p.kind === "street" ? "Street" : "People's daily route";
    case "wildlife_corridor":
      return `Animal path${species}`;
    case "delivery_route":
      return "Delivery route";
    case "habitat_zone":
      return "Nature area";
    case "ecological_buffer":
      return `Wildlife quiet zone${species}`;
    case "conflict_hotspot":
      return `Conflict${species}`;
    case "intervention":
      return p.scenario_role === "proposed" ? "Proposed fix" : "Agreed fix";
    case "barrier":
      return p.scenario_role === "proposed" ? "Proposed screen or barrier" : "Agreed screen or barrier";
    case "agreed_zone":
      return "Agreed coexistence zone";
    case "point_of_interest":
      return "Place";
    case "entrance":
      return "Building entrance";
    case "building":
      return "Building";
    default:
      return p.layer.replace(/_/g, " ");
  }
}
