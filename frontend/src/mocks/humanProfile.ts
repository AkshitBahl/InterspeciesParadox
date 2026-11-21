
import type { HumanProfile } from "../types";

export const defaultHumanProfile: HumanProfile = {
  displayName: "Alex Green",
  avatar: "🧑‍🚀",
  accent: "sage",

  bio: "City dweller, nature enthusiast, and friendly neighbor.",

  homeType: "Apartment",

  essentialNeeds: [
    "Safe access to home",
    "Emergency access",
  ],

  accessNeeds: [],

  dailyRoutines: [
    "Morning commute",
    "Daily deliveries",
  ],

  preferredSolutions: [
    "Temporary barriers",
    "Clear signage",
  ],

  priorities: {
    minimizeDetours: 4,
    quietEnvironment: 3,
  },
};
