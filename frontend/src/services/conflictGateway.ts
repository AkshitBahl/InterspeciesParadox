import type { ConflictDraft, ConflictReport } from "../types";
import { createConflict } from "./conflicts";
import { apiRequest } from "./apiClient";

// Turn this flag off ONLY after the report + detail endpoints are both ready.
// Current Step 6 assessment reads reports from localStorage synchronously;
// the gateway mirrors API-created reports there for compatibility during migration.
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

export async function submitConflict(draft: ConflictDraft): Promise<ConflictReport> {
  if (USE_MOCKS) return createConflict(draft);

  const report = await apiRequest<ConflictReport>("/conflicts", {
    method: "POST",
    body: JSON.stringify(draft),
  });

  // Temporary migration cache for the existing synchronous assessment page.
  // Not a secure store; don't use real personal/sensitive data in this prototype.
  const raw = localStorage.getItem("interspecies-conflicts");
  let current: ConflictReport[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) current = parsed as ConflictReport[];
  } catch {
    current = [];
  }
  try {
    localStorage.setItem(
      "interspecies-conflicts",
      JSON.stringify([report, ...current.filter((item) => item.id !== report.id)]),
    );
  } catch {
    // API submission succeeded even if optional local browser caching failed.
  }
  return report;
}
