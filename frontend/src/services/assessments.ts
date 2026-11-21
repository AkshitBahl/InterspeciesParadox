
import type {
  HumanProfile,
  ConflictReport,
  AssessmentResult,
  AssessedNeed,
  NeedTension,
} from "../types";

export function buildNeedsAssessment(
  conflict: ConflictReport,
  profile: HumanProfile
): AssessmentResult {
  // 1. Essential human requirements
  const humanNeeds: AssessedNeed[] = [
    {
      id: "human-access",
      title: "Safe access to home",
      description:
        "The resident must be able to enter and leave safely.",
      priority: "essential",
    },
    {
      id: "human-emergency",
      title: "Emergency access",
      description:
        "Emergency access must remain available.",
      priority: "essential",
    },
  ];

  // 2. Accessibility requirements from the human profile
  profile.accessNeeds.forEach((need, index) => {
    humanNeeds.push({
      id: `human-accessibility-${index}`,
      title: need,
      description:
        "An accessibility requirement selected by the resident.",
      priority: "essential",
    });
  });

  // 3. Daily-life concerns reported in the conflict
  conflict.affectedNeeds.forEach((need, index) => {
    humanNeeds.push({
      id: `human-impact-${index}`,
      title: need,
      description:
        "A part of daily life affected by this conflict.",
      priority: "preference",
    });
  });

  // 4. Provisional wildlife requirements
  const wildlifeNeeds: AssessedNeed[] = [
    {
      id: "wildlife-safety",
      title: "Protection from harm",
      description:
        "Avoid handling, harming or unnecessarily " +
        "disturbing the observed wildlife.",
      priority: "essential",
    },
  ];

  if (conflict.observedActivity === "nesting") {
    wildlifeNeeds.push({
      id: "wildlife-nesting",
      title: "Protect the active nesting area",
      description:
        "An occupied nest should not be disturbed. " +
        "Any intervention requires appropriate " +
        "species-specific guidance.",
      priority: "essential",
    });
  }

  if (conflict.observedActivity === "moving") {
    wildlifeNeeds.push({
      id: "wildlife-movement",
      title: "Safe movement",
      description:
        "Avoid creating obstacles or hazards along " +
        "the observed wildlife movement route.",
      priority: "essential",
    });
  }

  wildlifeNeeds.push({
    id: "wildlife-disturbance",
    title: "Reduced disturbance",
    description:
      "Minimize avoidable noise, close approaches " +
      "and disruption around the animal.",
    priority: "preference",
  });

  // 5. Identify where needs overlap or conflict
  const tensions: NeedTension[] = [];

  if (
    conflict.conflictType === "access" ||
    conflict.accessBlocked
  ) {
    tensions.push({
      id: "access-vs-habitat",
      title: "Human access vs. wildlife protection",
      description:
        "Residents need a usable entrance, while " +
        "wildlife activity may require a protected " +
        "area nearby.",
      type: "conflict",
    });
  }

  if (conflict.conflictType === "noise") {
    tensions.push({
      id: "noise-vs-habitat",
      title: "Comfort vs. wildlife activity",
      description:
        "The reported activity affects the resident's " +
        "comfort. The mediator should investigate " +
        "options that reduce disturbance safely.",
      type: "conflict",
    });
  }

  if (conflict.conflictType === "safety") {
    tensions.push({
      id: "safety-vs-contact",
      title: "Human safety and wildlife protection",
      description:
        "The solution must address the reported " +
        "safety concern without unnecessarily " +
        "harming the animal.",
      type: "conflict",
    });
  }

  if (conflict.conflictType === "property") {
    tensions.push({
      id: "property-vs-habitat",
      title: "Shared-space use vs. wildlife needs",
      description:
        "The way residents use this space overlaps " +
        "with the animal's observed activity.",
      type: "conflict",
    });
  }

  if (conflict.conflictType === "other") {
    tensions.push({
      id: "general-conflict",
      title: "Different needs in a shared space",
      description:
        "The reported situation needs closer review " +
        "before an appropriate intervention is chosen.",
      type: "conflict",
    });
  }

  // A shared goal always exists: safe coexistence.
  tensions.push({
    id: "shared-safety",
    title: "A safer shared environment",
    description:
      "Both residents and wildlife benefit from " +
      "reducing unexpected or harmful encounters.",
    type: "shared",
  });

  return {
    conflictId: conflict.id,
    humanNeeds,
    wildlifeNeeds,
    tensions,
    needsSpeciesVerification:
      conflict.speciesId === "unknown",
  };
}
