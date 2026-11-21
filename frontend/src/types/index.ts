
export type ProfileAccent = "forest" | "sage" | "peach";

export interface HumanProfile {
  displayName: string;
  avatar: string;
  accent: ProfileAccent;
  bio: string;
  homeType: "Apartment" | "House" | "Shared building";

  essentialNeeds: string[];
  accessNeeds: string[];
  dailyRoutines: string[];
  preferredSolutions: string[];

  priorities: {
    minimizeDetours: number;
    quietEnvironment: number;
  };
}

export type ConflictType =
  | "access"
  | "noise"
  | "safety"
  | "property"
  | "other";

export type WildlifeActivity =
  | "nesting"
  | "moving"
  | "feeding"
  | "resting"
  | "unknown";

export interface ConflictReport {
  id: string;
  title: string;
  description: string;
  speciesId: string;
  conflictType: ConflictType;
  observedActivity: WildlifeActivity;
  location: string;
  severity: number;
  affectedNeeds: string[];
  accessBlocked: boolean;
  status: "reported" | "assessing" | "mediation" | "agreed";
  createdAt: string;
}

export type ConflictDraft = Omit<
  ConflictReport,
  "id" | "status" | "createdAt"
>;
