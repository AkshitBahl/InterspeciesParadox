
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
