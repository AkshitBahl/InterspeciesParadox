
import type { ConflictReport } from "../types";

export const demoConflict: ConflictReport = {
  id: "demo",
  title: "A bird is nesting near my entrance",

  description:
    "A bird has built a nest beside our apartment " +
    "entrance. We want to protect it, but residents " +
    "need to enter and leave the building safely.",

  speciesId: "robin",
  conflictType: "access",
  observedActivity: "nesting",
  location: "Apartment building entrance",
  severity: 4,

  affectedNeeds: [
    "Getting in or out",
    "Daily deliveries",
  ],

  accessBlocked: false,
  status: "reported",
  createdAt: new Date().toISOString(),
};
