import type { HumanProfile } from "../../types";
import type {
  EvaluatedPlan,
  MediationPlan,
  PlanAdjustment,
  PlanScores,
} from "../../types/mediation";

function cap(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function adjustPlan(
  original: MediationPlan,
  adjustments: PlanAdjustment[]
): MediationPlan {
  const scores: PlanScores = { ...original.scores };
  const interventions = [...original.interventions];

  if (adjustments.includes("delivery-window")) {
    interventions.push("Requested: designated delivery window");
    scores.disturbanceReduction = cap(scores.disturbanceReduction + 5);
    scores.practicality = cap(scores.practicality - 3);
  }
  if (adjustments.includes("accessible-signs")) {
    interventions.push("Requested: high-contrast accessible wayfinding");
    scores.humanAccess = cap(scores.humanAccess + 3);
    scores.practicality = cap(scores.practicality - 1);
  }

  return { ...original, interventions, scores };
}

export function evaluatePlan(
  plan: MediationPlan,
  human: HumanProfile
): EvaluatedPlan {
  const reasons: string[] = [];
  if (!plan.constraints.protectsNestingArea) {
    reasons.push("Does not preserve the nesting area.");
  }
  if (!plan.constraints.emergencyAccess) {
    reasons.push("Does not maintain emergency access.");
  }
  if (
    human.accessNeeds.some((need) =>
      ["Step-free route", "No stairs"].includes(need)
    ) && !plan.constraints.stepFreeAccess
  ) {
    reasons.push("Does not meet your step-free access requirement.");
  }
  if (
    human.accessNeeds.includes("Wide passage") &&
    !plan.constraints.widePassage
  ) {
    reasons.push("Does not meet your wide-passage requirement.");
  }

  // Hard constraints are evaluated BEFORE the illustrative index.
  // The index is the lowest dimension: no high score can compensate
  // for a poor outcome elsewhere (a 'weakest-link' index).
  const index = reasons.length === 0
    ? Math.min(...Object.values(plan.scores))
    : null;

  return { plan, eligible: reasons.length === 0, reasons, index };
}
