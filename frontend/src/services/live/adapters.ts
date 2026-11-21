import type {
  AssessedNeed,
  ConflictDraft,
  ConflictReport,
  ConflictType,
  NeedTension,
  WildlifeActivity,
  WildlifeRepresentative,
} from "../../types";
import type {
  Assessment,
  BackendConflictStatus,
  ConflictCreateBody,
  LiveConflict,
  MapLocation,
  Need,
  Solution,
  SpeciesDetail,
  SpeciesSummary,
} from "./types";

/**
 * Translators between the frontend's shapes (built for mock mode) and the backend's.
 * The backend stays the judge: needs, plans and scores always come from it.
 */

// Each seeded species has one typical conflict category in the backend.
const categoryBySpecies: Record<string, string> = {
  "house-martin": "nest_near_entrance",
  "common-pipistrelle": "roost_in_renovation",
  "red-mason-bee": "pollinators_on_balcony",
  "peregrine-falcon": "rooftop_works",
  "european-hedgehog": "movement_vs_mobility",
  "red-fox": "den_near_play_area",
};

function categoryFor(speciesSlug: string, conflictType: ConflictType): string {
  if (conflictType === "noise") return "noise_or_light";
  return categoryBySpecies[speciesSlug] ?? "other";
}

function activityFor(draft: ConflictDraft): string {
  const needs = draft.affectedNeeds;
  if (draft.accessBlocked || needs.includes("Getting in or out") || needs.includes("Accessibility")) {
    return "entrance_use";
  }
  if (needs.includes("Daily deliveries")) return "deliveries";
  if (needs.includes("Using shared spaces")) return "space_use";
  const byType: Record<ConflictType, string> = {
    access: "entrance_use",
    noise: "other",
    safety: "space_use",
    property: "space_use",
    other: "other",
  };
  return byType[draft.conflictType];
}

/**
 * `draft.location` holds a map feature id in live mode (the form shows a list of places).
 * `homeSiteId` is the species' home on the map, so the backend can measure how close people get to it.
 */
export function draftToCreateBody(
  draft: ConflictDraft,
  place: MapLocation | undefined,
  homeSiteId?: string
): ConflictCreateBody {
  const body: ConflictCreateBody = {
    title: draft.title,
    description: draft.description,
    species_slug: draft.speciesId,
    category: categoryFor(draft.speciesId, draft.conflictType),
    severity: draft.severity,
    human_activity: {
      type: activityFor(draft),
      description: place ? place.name : draft.location,
    },
  };
  if (place?.layer === "wildlife_site") {
    body.site_feature_id = place.feature_id;
  } else if (place) {
    body.location = { type: "Point", coordinates: [place.lon, place.lat] };
    if (place.layer === "building") body.building_feature_id = place.feature_id;
    if (homeSiteId) body.site_feature_id = homeSiteId;
  }
  return body;
}

const statusMap: Record<BackendConflictStatus, ConflictReport["status"]> = {
  reported: "reported",
  assessed: "assessing",
  solutions_proposed: "mediation",
  negotiating: "mediation",
  agreement_pending: "mediation",
  agreed: "agreed",
  closed: "agreed",
};

export const statusLabels: Record<BackendConflictStatus, string> = {
  reported: "Reported",
  assessed: "Needs assessed",
  solutions_proposed: "Plans proposed",
  negotiating: "Negotiating",
  agreement_pending: "Waiting for signature",
  agreed: "Agreement active",
  closed: "Closed",
};

/** Fields the backend doesn't store, kept in this browser so the report card stays complete. */
export interface LocalConflictExtras {
  conflictType: ConflictType;
  observedActivity: WildlifeActivity;
  affectedNeeds: string[];
  accessBlocked: boolean;
}

export function conflictToReport(conflict: LiveConflict, extras?: LocalConflictExtras): ConflictReport {
  return {
    id: conflict.id,
    title: conflict.title,
    description: conflict.description,
    speciesId: conflict.species.slug,
    conflictType: extras?.conflictType ?? "other",
    observedActivity: extras?.observedActivity ?? "unknown",
    location: conflict.human_activity?.description || `${conflict.lat.toFixed(5)}, ${conflict.lon.toFixed(5)}`,
    severity: conflict.severity,
    affectedNeeds: extras?.affectedNeeds ?? [],
    accessBlocked: extras?.accessBlocked ?? false,
    status: statusMap[conflict.status] ?? "reported",
    createdAt: conflict.created_at,
  };
}

export function speciesToRepresentative(
  species: SpeciesSummary | SpeciesDetail,
  introduction?: string
): WildlifeRepresentative {
  const rep = "representative" in species ? species.representative : null;
  return {
    id: species.slug,
    name: rep?.name ?? species.representative_name,
    emoji: rep?.avatar_emoji ?? species.emoji,
    personality: rep ? `${rep.title} · ${species.common_name}` : species.common_name,
    introduction: introduction ?? rep?.greeting ?? "",
  };
}

export function needToAssessed(need: Need): AssessedNeed {
  return {
    id: need.key,
    title: need.label,
    description: need.description,
    priority: need.hard ? "essential" : "preference",
  };
}

export function assessmentTensions(assessment: Assessment): NeedTension[] {
  const label = (key: string) =>
    [...assessment.human_needs, ...assessment.wildlife_needs].find((need) => need.key === key)?.label ?? key;

  return [
    ...assessment.conflicting_needs.map((pair, index) => ({
      id: `conflict-${index}`,
      title: `${label(pair.human_need)} vs ${label(pair.wildlife_need)}`,
      description: pair.explanation,
      type: "conflict" as const,
    })),
    ...assessment.compatible_needs.map((pair, index) => ({
      id: `shared-${index}`,
      title: `${label(pair.human_need)} + ${label(pair.wildlife_need)}`,
      description: pair.explanation,
      type: "shared" as const,
    })),
  ];
}

const partyNames: Record<string, string> = {
  reporter: "Reporting resident",
  residents: "Residents",
  building_manager: "Building manager",
  contractor: "Contractor",
  ecologist: "Ecologist",
  delivery_operator: "Delivery operator",
  city: "City services",
  species_representative: "Species representative",
};

export function partyLabel(party: string): string {
  return partyNames[party] ?? party.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function formatDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** A plan can be chosen when it is legal and passes every gate of the Coexistence Index. */
export function planBlockers(solution: Solution): string[] {
  const gates = solution.index_breakdown?.gates ?? [];
  // The same note can come from several checks, so show each one once.
  return [
    ...new Set([
      ...solution.legal_notes,
      ...gates.filter((gate) => !gate.passed).flatMap((gate) => gate.notes),
      ...(solution.index_breakdown?.limit_violations ?? []),
    ]),
  ];
}

export function isEligible(solution: Solution): boolean {
  return solution.legal_compliant && (solution.index_breakdown?.gates ?? []).every((gate) => gate.passed);
}
