import { ensureDeviceRegistered } from "@/lib/desktop/device";

export type VersionLocalCopy = {
  version_id: string;
  device_id: string;
  checksum: string;
  confirmed_at: string;
};

/** Confirms this device has a local copy of a version — no-ops outside the desktop app. */
export async function recordLocalCopy(
  versionId: string,
  checksum: string
): Promise<void> {
  const deviceId = await ensureDeviceRegistered();
  if (!deviceId) return;
  try {
    await fetch("/api/version-local-copies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId, deviceId, checksum }),
    });
  } catch (err) {
    // Best-effort: a missed confirmation just means this version stays in
    // the cloud past the cap a little longer, which is the safe direction
    // to fail in — see lib/version-prune.ts.
    console.warn("[version-local-copies] confirm failed", versionId, err);
  }
}

/** Map of versionId -> confirmed local copies (possibly on other devices). */
export async function fetchLocalCopiesForVersions(
  versionIds: string[]
): Promise<Map<string, VersionLocalCopy[]>> {
  const map = new Map<string, VersionLocalCopy[]>();
  if (versionIds.length === 0) return map;
  try {
    const res = await fetch(
      `/api/version-local-copies?versionIds=${versionIds.map(encodeURIComponent).join(",")}`
    );
    if (!res.ok) return map;
    const data = await res.json().catch(() => null);
    const copies: VersionLocalCopy[] = Array.isArray(data?.copies) ? data.copies : [];
    for (const copy of copies) {
      const list = map.get(copy.version_id) ?? [];
      list.push(copy);
      map.set(copy.version_id, list);
    }
  } catch {
    /* best-effort — badges just show less than they could */
  }
  return map;
}
