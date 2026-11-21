import { useSyncExternalStore } from "react";
import { getSession, onSessionChange, type LiveSession } from "../../services/live/client";

let cachedRaw: string | null = null;
let cached: LiveSession | null = null;

function snapshot(): LiveSession | null {
  const current = getSession();
  const raw = current ? JSON.stringify(current) : null;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = current;
  }
  return cached;
}

/** The logged-in user for the live backend, or null. Updates on login, logout and token refresh. */
export function useSession(): LiveSession | null {
  return useSyncExternalStore(onSessionChange, snapshot, () => null);
}

/** Seeded demo residents (password for all: coexist2126). */
export const demoAccounts = [
  { email: "lina@example.org", name: "Lina Okafor", story: "House martins above the main door (agreement active)" },
  { email: "jonas@example.org", name: "Jonas Verbeke", story: "Bats in the roof he wants to renovate (negotiating)" },
  { email: "mei@example.org", name: "Mei Tanaka", story: "Mason bees in her balcony blind, she's allergic" },
  { email: "rafael@example.org", name: "Rafael Duarte", story: "Peregrine chicks next to the solar panels" },
  { email: "noor@example.org", name: "Noor El Idrissi", story: "Fox cubs under the shed by the playground (new)" },
  { email: "ops@example.org", name: "GreenLoop Deliveries", story: "Delivery robots on the hedgehog highway" },
];

export const DEMO_PASSWORD = "coexist2126";
