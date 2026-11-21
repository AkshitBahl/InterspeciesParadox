
import type {
  ConflictDraft,
  ConflictReport,
} from "../types";

const STORAGE_KEY = "interspecies-conflicts";

export function getConflicts(): ConflictReport[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed)
      ? (parsed as ConflictReport[])
      : [];
  } catch {
    return [];
  }
}

export function getConflictById(
  id: string
): ConflictReport | undefined {
  return getConflicts().find(
    (conflict) => conflict.id === id
  );
}

export async function createConflict(
  draft: ConflictDraft
): Promise<ConflictReport> {
  const conflict: ConflictReport = {
    ...draft,
    id: crypto.randomUUID(),
    status: "reported",
    createdAt: new Date().toISOString(),
  };

  const conflicts = getConflicts();

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([conflict, ...conflicts])
  );

  return conflict;
}
