import type {
  WildlifeActivity,
  WildlifeRepresentative,
} from "../../types";

export type DialogueTopic = "welcome" | "needs" | "worries" | "compromise" | "plan";
export type WildlifeMood = "curious" | "thoughtful" | "concerned" | "hopeful";

export interface DialogueLine {
  message: string;
  mood: WildlifeMood;
  heading: string;
}

type Voice = Partial<Record<DialogueTopic, string>>;

// Fictional storytelling copy, NOT verified species advice or an AI inference.
// The backend's assessment remains the source of the actual ecological constraints.
const voices: Record<string, Voice> = {
  robin: {
    needs: "A quiet nesting spot can be important when I'm raising young. Could we avoid unnecessary disturbance while someone checks the situation?",
    worries: "Frequent close approaches around a nesting area might be stressful. Please don't try to move the nest yourself.",
    compromise: "Perhaps there's a way to keep your entrance usable while protecting the space nearby. A qualified person should assess the details first.",
  },
  fox: {
    needs: "A safe place to travel and shelter matters to wildlife like me. Space and predictable human activity can help avoid encounters.",
    worries: "Sudden close encounters are not fun for either of us. Giving wild animals room is a good starting point.",
    compromise: "We could look at how paths and shared spaces are used, without blocking access or putting anyone at risk.",
  },
  hedgehog: {
    needs: "Shelter and safe movement through green spaces matter to small animals like me.",
    worries: "Busy paths and unexpected obstacles can make moving around difficult. Please leave wildlife undisturbed.",
    compromise: "Maybe there is a safer way for humans and small wildlife to pass through this shared space.",
  },
  bee: {
    needs: "Pollinators depend on suitable food sources and places to live. Different species have different requirements.",
    worries: "When people and insects get too close, everyone can feel uncomfortable. Identifying the species is a good first step.",
    compromise: "We can explore ways to reduce unwanted encounters while respecting pollinator habitat, with species-specific advice.",
  },
  unknown: {
    needs: "We still need to identify the animal before describing its particular biological needs.",
    worries: "Guessing what a species needs could lead to a risky decision. Let's gather a little more information first.",
    compromise: "The safest next step is to verify the species and location before suggesting any physical change.",
  },
};

const topicHeading: Record<DialogueTopic, string> = {
  welcome: "A little introduction",
  needs: "What might matter to me",
  worries: "What could go wrong",
  compromise: "Finding shared ground",
  plan: "About this plan",
};

const topicMood: Record<DialogueTopic, WildlifeMood> = {
  welcome: "curious",
  needs: "thoughtful",
  worries: "concerned",
  compromise: "hopeful",
  plan: "thoughtful",
};

export function getWildlifeLine(
  representative: WildlifeRepresentative,
  activity: WildlifeActivity,
  topic: DialogueTopic,
  featuredMessage?: string
): DialogueLine {
  const voice = voices[representative.id] ?? voices.unknown;
  let message: string;

  if (topic === "welcome") {
    message = representative.introduction;
  } else if (topic === "plan") {
    message = featuredMessage?.trim() ||
      "This is an idea for the humans to consider. Please check that it respects both human needs and wildlife protection.";
  } else {
    message = voice[topic] ?? voices.unknown[topic] ?? "Let's understand the situation more carefully.";
  }

  // Only change the needs message for a reported nesting scenario.
  // Do not claim to have confirmed that a nest is active.
  if (topic === "needs" && activity === "nesting" && representative.id !== "unknown") {
    message = "You reported possible nesting nearby. If a nest is active, it may need protection from disturbance. Please verify the situation before changing the space.";
  }

  return {
    message,
    mood: topicMood[topic],
    heading: topicHeading[topic],
  };
}
