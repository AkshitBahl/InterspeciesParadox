export type RouteVariant = "protected" | "alternative" | "managed";
export type PlanAdjustment = "delivery-window" | "accessible-signs";

export interface PlanScores {
  wildlifeProtection: number;
  humanAccess: number;
  disturbanceReduction: number;
  practicality: number;
}

export interface MediationPlan {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  interventions: string[];
  route: RouteVariant;
  constraints: {
    protectsNestingArea: boolean;
    emergencyAccess: boolean;
    stepFreeAccess: boolean;
    widePassage: boolean;
  };
  scores: PlanScores;
  wildlifeMessage: string;
}

export interface EvaluatedPlan {
  plan: MediationPlan;
  eligible: boolean;
  reasons: string[];
  index: number | null;
}

export interface MediationDraft {
  conflictId: string;
  selectedPlan: MediationPlan;
  coexistenceIndex: number;
  adjustments: PlanAdjustment[];
  savedAt: string;
}
