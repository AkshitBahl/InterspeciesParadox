import type { HumanProfile } from "../../types";
import { liveApi } from "./api";
import { getSession } from "./client";

const clamp = (value: number) => Math.max(1, Math.min(5, Math.round(value)));

/**
 * Sends the parts of the profile the backend's needs engine uses.
 * Access needs become hard human needs; priorities weigh the plans.
 */
export async function syncProfileToBackend(profile: HumanProfile): Promise<void> {
  if (!getSession()) throw new Error("Log in to save your profile to the backend.");
  const current = await liveApi.getProfile();
  const base = { safety: 3, convenience: 3, cost: 3, nature: 3, quiet: 3, ...current.priorities };
  await liveApi.patchProfile({
    bio: profile.bio || null,
    mobility_needs: profile.accessNeeds.map((need) => need.toLowerCase()),
    noise_tolerance: clamp(6 - profile.priorities.quietEnvironment),
    priorities: {
      ...base,
      convenience: clamp(profile.priorities.minimizeDetours),
      quiet: clamp(profile.priorities.quietEnvironment),
    },
  });
}
