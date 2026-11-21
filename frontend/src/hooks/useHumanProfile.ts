
import { useState } from "react";

import type { HumanProfile } from "../types";
import { defaultHumanProfile } from "../mocks/humanProfile";
import { USE_MOCKS } from "../services/conflictGateway";
import { syncProfileToBackend } from "../services/live/profileSync";

const STORAGE_KEY = "interspecies-human-profile";

function loadProfile(): HumanProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved) as Partial<HumanProfile>;

      return {
        ...defaultHumanProfile,
        ...parsed,
        priorities: {
          ...defaultHumanProfile.priorities,
          ...parsed.priorities,
        },
        // Safety requirements cannot be removed through
        // profile customization.
        essentialNeeds: defaultHumanProfile.essentialNeeds,
      };
    }
  } catch {
    // Use defaults if storage is unavailable or invalid.
  }

  return defaultHumanProfile;
}

export function useHumanProfile() {
  const [profile, setProfile] = useState<HumanProfile>(loadProfile);
  const [saveStatus, setSaveStatus] =
    useState<"idle" | "saved" | "error">("idle");

  function updateProfile(updated: HumanProfile) {
    setProfile(updated);
    setSaveStatus("idle");
  }

  function saveProfile() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(profile)
      );
      if (USE_MOCKS) {
        setSaveStatus("saved");
      } else {
        // Live mode: the backend uses your access needs and priorities in the assessment.
        syncProfileToBackend(profile).then(
          () => setSaveStatus("saved"),
          () => setSaveStatus("error")
        );
      }
    } catch {
      setSaveStatus("error");
    }
  }

  return {
    profile,
    updateProfile,
    saveProfile,
    saveStatus,
  };
}
