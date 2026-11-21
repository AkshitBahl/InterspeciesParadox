
export const wildlifeOptions = [
  {
    id: "robin",
    name: "European Robin",
    emoji: "🐦",
    description: "Small urban bird",
  },
  {
    id: "fox",
    name: "Red Fox",
    emoji: "🦊",
    description: "Urban mammal",
  },
  {
    id: "hedgehog",
    name: "Hedgehog",
    emoji: "🦔",
    description: "Small nocturnal mammal",
  },
  {
    id: "bee",
    name: "Bee / Pollinator",
    emoji: "🐝",
    description: "Species not yet identified",
  },
  {
    id: "unknown",
    name: "I'm not sure",
    emoji: "🔎",
    description: "Help me identify it later",
  },
];


import type { WildlifeRepresentative } from "../types";

export const wildlifeRepresentatives: Record<
  string,
  WildlifeRepresentative
> = {
  robin: {
    id: "robin",
    name: "Robin",
    emoji: "🐦",
    personality: "Gentle but protective",
    introduction:
      "Hello, neighbor! I like having my own space, " +
      "especially when I'm raising a family.",
  },

  fox: {
    id: "fox",
    name: "Felix the Fox",
    emoji: "🦊",
    personality: "Clever and cautious",
    introduction:
      "I know we're sharing a neighborhood. " +
      "Let's find a way to avoid surprising each other.",
  },

  hedgehog: {
    id: "hedgehog",
    name: "Hazel the Hedgehog",
    emoji: "🦔",
    personality: "Shy and thoughtful",
    introduction:
      "I prefer quiet places and safe routes. " +
      "I'd love to move around without getting in your way.",
  },

  bee: {
    id: "bee",
    name: "Buzz",
    emoji: "🐝",
    personality: "Energetic and friendly",
    introduction:
      "I'm just trying to find what I need. " +
      "A little space between us would be lovely!",
  },

  unknown: {
    id: "unknown",
    name: "Mystery Neighbor",
    emoji: "🐾",
    personality: "Awaiting identification",
    introduction:
      "We haven't identified your wild neighbor yet. " +
      "Let's gather more information before deciding what it needs.",
  },
};

export function getWildlifeRepresentative(
  speciesId: string
): WildlifeRepresentative {
  return (
    wildlifeRepresentatives[speciesId] ??
    wildlifeRepresentatives.unknown
  );
}
