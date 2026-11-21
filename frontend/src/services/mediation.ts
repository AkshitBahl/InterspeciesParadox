import type { MediationDraft } from "../types/mediation";

export function saveMediationDraft(draft: MediationDraft): void {
  localStorage.setItem(
    `interspecies-mediation:${draft.conflictId}`,
    JSON.stringify(draft)
  );
}

export function getMediationDraft(conflictId: string): MediationDraft | null {
  try {
    const raw = localStorage.getItem(`interspecies-mediation:${conflictId}`);
    return raw ? (JSON.parse(raw) as MediationDraft) : null;
  } catch {
    return null;
  }
}
