import type { LocalConflictExtras } from "./adapters";

const KEY = "interspecies-live-extras";

function readAll(): Record<string, LocalConflictExtras> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, LocalConflictExtras>) : {};
  } catch {
    return {};
  }
}

export function getConflictExtras(conflictId: string): LocalConflictExtras | undefined {
  return readAll()[conflictId];
}

export function saveConflictExtras(conflictId: string, extras: LocalConflictExtras): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [conflictId]: extras }));
  } catch {
    // Optional: the report itself is already saved in the backend.
  }
}
