/**
 * sessionStorage keys for carrying v1 focus-mode context (checklist subset,
 * selected references) from the start dialog into the reduced focus shell
 * without a schema change (FEATURE-SPECS §10-§11).
 */

export function FOCUS_CHECKLIST_KEY(trackId: string): string {
  return `tempo.focusChecklist.${trackId}`;
}

export function FOCUS_REFERENCES_KEY(trackId: string): string {
  return `tempo.focusReferences.${trackId}`;
}

export function readSessionIdArray(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
