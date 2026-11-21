import type { MediationPlan } from "../types/mediation";

// Deliberately fictional hackathon examples — never safety or wildlife guidance.
export const demoPlans: MediationPlan[] = [
  {
    id: "shared-corridor",
    title: "Shared corridor",
    subtitle: "Protect the nest while preserving the entrance",
    summary: "Explore a temporary screened approach, clear wayfinding and reduced disruption, subject to specialist review.",
    interventions: ["Proposed protected pedestrian corridor", "Proposed temporary screening", "Reduced-noise maintenance"],
    route: "protected",
    constraints: {
      protectsNestingArea: true,
      emergencyAccess: true,
      stepFreeAccess: true,
      widePassage: true,
    },
    scores: { wildlifeProtection: 88, humanAccess: 92, disturbanceReduction: 80, practicality: 82 },
    wildlifeMessage: "A little distance around my nesting place could help us share this entrance — if specialists confirm the arrangement is suitable.",
  },
  {
    id: "alternative-entrance",
    title: "Alternative entrance",
    subtitle: "Give the nesting area extra space",
    summary: "Explore a temporary side route and separate delivery access. The demo route has steps, so it may not meet accessibility needs.",
    interventions: ["Proposed side pedestrian route", "Separate delivery drop-off", "Temporary directional signs"],
    route: "alternative",
    constraints: {
      protectsNestingArea: true,
      emergencyAccess: true,
      stepFreeAccess: false,
      widePassage: false,
    },
    scores: { wildlifeProtection: 94, humanAccess: 70, disturbanceReduction: 90, practicality: 76 },
    wildlifeMessage: "Using a different entrance could give the nesting area more quiet, but it must also work for your daily access needs.",
  },
  {
    id: "managed-access",
    title: "Managed access",
    subtitle: "Coordinate busy times at the existing entrance",
    summary: "Explore changed delivery times, lower-noise maintenance and monitored access procedures without moving the nest.",
    interventions: ["Managed deliveries", "Low-noise maintenance windows", "Resident information notice"],
    route: "managed",
    constraints: {
      protectsNestingArea: true,
      emergencyAccess: true,
      stepFreeAccess: true,
      widePassage: true,
    },
    scores: { wildlifeProtection: 79, humanAccess: 94, disturbanceReduction: 76, practicality: 91 },
    wildlifeMessage: "A predictable routine sounds promising, but somebody still needs to check whether the activity near the nest is acceptable.",
  },
];
