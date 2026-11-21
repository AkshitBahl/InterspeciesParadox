import type { PlanAdjustment, PlanScores, RouteVariant } from "./mediation";

export type AgreementTermGroup = "wildlife" | "human" | "shared" | "review";

export interface AgreementTerm {
  id: string;
  group: AgreementTermGroup;
  title: string;
  description: string;
  responsibleParty: string;
}

// A preview is generated entirely from a saved Step 7 mediation draft.
// It's not an official authorization or a signed contract.
export interface AgreementPreview {
  conflictId: string;
  mediationSavedAt: string;
  conflictTitle: string;
  conflictLocation: string;
  humanName: string;
  humanAvatar: string;
  wildlifeName: string;
  wildlifeEmoji: string;
  planId: string;
  planTitle: string;
  planSummary: string;
  proposedRoute: RouteVariant;
  proposedInterventions: string[];
  adjustments: PlanAdjustment[];
  coexistenceIndex: number;
  scores: PlanScores;
  terms: AgreementTerm[];
  reviewTriggers: string[];
}

export interface SavedAgreementDraft extends AgreementPreview {
  id: string;
  status: "saved_draft";
  savedAt: string;
}
