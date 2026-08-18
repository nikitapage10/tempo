/**
 * Which microphone, camera, and speaker a Session call should use.
 *
 * Kept out of React so the fallback rules stay testable: a remembered device
 * that has since been unplugged must quietly fall back to the system default
 * rather than leaving somebody on a dead microphone.
 */

export type AvKind = "audioinput" | "videoinput" | "audiooutput";

export type AvSelection = Record<AvKind, string | null>;

export const AV_STORAGE_KEY = "tempo:session-av:v1";

export const EMPTY_AV_SELECTION: AvSelection = {
  audioinput: null,
  videoinput: null,
  audiooutput: null,
};

/** Minimal slice of localStorage, so tests can pass a plain object. */
export type AvStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function isKind(value: string): value is AvKind {
  return value === "audioinput" || value === "videoinput" || value === "audiooutput";
}

export function readAvSelection(store: AvStore | null | undefined): AvSelection {
  if (!store) return { ...EMPTY_AV_SELECTION };
  let raw: string | null = null;
  try {
    raw = store.getItem(AV_STORAGE_KEY);
  } catch {
    return { ...EMPTY_AV_SELECTION };
  }
  if (!raw) return { ...EMPTY_AV_SELECTION };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next = { ...EMPTY_AV_SELECTION };
    for (const [key, value] of Object.entries(parsed)) {
      if (isKind(key) && typeof value === "string" && value) next[key] = value;
    }
    return next;
  } catch {
    return { ...EMPTY_AV_SELECTION };
  }
}

export function writeAvSelection(store: AvStore | null | undefined, selection: AvSelection): void {
  if (!store) return;
  try {
    store.setItem(AV_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    /* a private window that refuses storage still gets working defaults */
  }
}

/** null means "whatever the system picks" — the only safe fallback. */
export function resolveDevice(preferred: string | null, availableIds: string[]): string | null {
  if (!preferred) return null;
  return availableIds.includes(preferred) ? preferred : null;
}

/** Browsers hide device labels until a permission has been granted once. */
export function deviceLabel(device: { label?: string; deviceId: string }, kind: AvKind, index: number): string {
  if (device.label) return device.label;
  if (device.deviceId === "default") return "System default";
  const noun = kind === "audioinput" ? "Microphone" : kind === "videoinput" ? "Camera" : "Speaker";
  return `${noun} ${index + 1}`;
}

/**
 * Real device lists carry a synthetic "default"/"communications" entry on
 * Windows that duplicates a physical device. Keep the first, drop the rest,
 * so the picker doesn't show the same headset three times.
 */
export function dedupeDevices<T extends { deviceId: string; groupId?: string; label?: string }>(
  devices: T[]
): T[] {
  const seenGroups = new Set<string>();
  const out: T[] = [];
  for (const device of devices) {
    if (!device.deviceId) continue;
    if (device.deviceId === "default" || device.deviceId === "communications") {
      out.push(device);
      continue;
    }
    const group = device.groupId ?? "";
    if (group && seenGroups.has(group)) continue;
    if (group) seenGroups.add(group);
    out.push(device);
  }
  return out;
}
