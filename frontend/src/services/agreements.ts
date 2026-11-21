import type { ConflictReport, HumanProfile, WildlifeRepresentative } from "../types";
import type { MediationDraft } from "../types/mediation";
import type {
  AgreementPreview,
  AgreementTerm,
  SavedAgreementDraft,
} from "../types/agreement";

const storageKey = (conflictId: string) =>
  `interspecies-agreement:${conflictId}`;

export function buildAgreementPreview(
  conflict: ConflictReport,
  human: HumanProfile,
  wildlife: WildlifeRepresentative,
  mediation: MediationDraft
): AgreementPreview {
  const terms: AgreementTerm[] = [
    {
      id: "wildlife-protection",
      group: "wildlife",
      title: "Protect the active nesting area",
      description:
        "Do not handle, relocate, or disturb the nest. Any proposed work near the nest needs species-specific professional assessment and any legally required authorization.",
      responsibleParty: "Residents and building management",
    },
    {
      id: "human-access",
      group: "human",
      title: "Maintain safe entry and emergency access",
      description:
        "Keep an accessible, usable path for residents and ensure emergency services can reach the building.",
      responsibleParty: "Building management",
    },
    ...human.accessNeeds.map((need, index): AgreementTerm => ({
      id: `access-${index}`,
      group: "human",
      title: `Accessibility: ${need}`,
      description:
        "The chosen arrangement must continue to meet this essential accessibility requirement.",
      responsibleParty: "Building management",
    })),
    ...mediation.selectedPlan.interventions.map(
      (intervention, index): AgreementTerm => ({
        id: `action-${index}`,
        group: "shared",
        title: intervention,
        description:
          "Suggested action only. Confirm feasibility, accessibility, and wildlife safety before any physical installation or change.",
        responsibleParty: "Building management / authorized specialists",
      })
    ),
    {
      id: "review-status",
      group: "review",
      title: "Review before activation or completion",
      description:
        "Ask an appropriately qualified specialist to confirm wildlife requirements and relevant permissions. Review the plan if nesting, safety, or access conditions change.",
      responsibleParty: "Building management / wildlife specialist",
    },
  ];

  return {
    conflictId: conflict.id,
    mediationSavedAt: mediation.savedAt,
    conflictTitle: conflict.title,
    conflictLocation: conflict.location,
    humanName: human.displayName || "Resident",
    humanAvatar: human.avatar,
    wildlifeName: wildlife.name,
    wildlifeEmoji: wildlife.emoji,
    planId: mediation.selectedPlan.id,
    planTitle: mediation.selectedPlan.title,
    planSummary: mediation.selectedPlan.summary,
    proposedRoute: mediation.selectedPlan.route,
    proposedInterventions: mediation.selectedPlan.interventions,
    adjustments: mediation.adjustments,
    coexistenceIndex: mediation.coexistenceIndex,
    scores: mediation.selectedPlan.scores,
    terms,
    reviewTriggers: [
      "An authorized specialist confirms the nest is no longer active.",
      "Emergency access or an accessibility requirement is affected.",
      "Wildlife activity or the surrounding environment changes.",
    ],
  };
}

export function getSavedAgreementDraft(
  conflictId: string
): SavedAgreementDraft | null {
  try {
    const raw = localStorage.getItem(storageKey(conflictId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("conflictId" in parsed) ||
      parsed.conflictId !== conflictId ||
      !("status" in parsed) ||
      parsed.status !== "saved_draft" ||
      !("terms" in parsed) ||
      !Array.isArray(parsed.terms)
    ) {
      return null;
    }
    return parsed as SavedAgreementDraft;
  } catch {
    return null;
  }
}

export function saveAgreementDraft(
  preview: AgreementPreview
): SavedAgreementDraft {
  const saved: SavedAgreementDraft = {
    ...preview,
    id: crypto.randomUUID(),
    status: "saved_draft",
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(storageKey(preview.conflictId), JSON.stringify(saved));
  return saved;
}

export function formatAgreementText(preview: AgreementPreview): string {
  const sections: Array<[string, AgreementTerm[]]> = [
    ["WILDLIFE PROTECTION", preview.terms.filter((t) => t.group === "wildlife")],
    ["HUMAN ACCESS & SAFETY", preview.terms.filter((t) => t.group === "human")],
    ["PROPOSED SHARED ACTIONS", preview.terms.filter((t) => t.group === "shared")],
    ["REVIEW", preview.terms.filter((t) => t.group === "review")],
  ];
  return [
    "THE INTERSPECIES PARADOX — COEXISTENCE AGREEMENT DRAFT",
    "NOT AN OFFICIAL AUTHORIZATION OR A SIGNED AGREEMENT",
    "",
    `Conflict: ${preview.conflictTitle}`,
    `Location: ${preview.conflictLocation}`,
    `Human representative: ${preview.humanName}`,
    `Wildlife representative (fictional): ${preview.wildlifeName}`,
    `Selected plan: ${preview.planTitle}`,
    `Plan summary: ${preview.planSummary}`,
    `Illustrative Coexistence Index: ${preview.coexistenceIndex}/100`,
    "",
    ...sections.flatMap(([title, terms]) => [
      title,
      ...terms.map((term) =>
        `- ${term.title}: ${term.description} (Responsible: ${term.responsibleParty})`
      ),
      "",
    ]),
    "REVIEW TRIGGERS",
    ...preview.reviewTriggers.map((trigger) => `- ${trigger}`),
    "",
    "This is a proposed arrangement for a hackathon demonstration. No wildlife has consented or been consulted. Professional review and any required permissions must come before implementation.",
  ].join("\n");
}
