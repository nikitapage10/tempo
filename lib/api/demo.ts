/**
 * Client side of the demo workspace.
 *
 * The two switches at the bottom are the fiddly part: the active artist and
 * space are remembered in localStorage, so entering and leaving the demo has to
 * move those pointers or the app comes back up looking at an artist that either
 * isn't there yet or has just been deleted.
 */

import { PREFER_DEMO_ARTIST_KEY } from "@/lib/constants";
import { writeStoredArtistId, writeStoredSpaceId, clearLegacyWorkspaceMemory } from "@/lib/auth/workspace-memory";

export type DemoArtist = {
  artistId: string;
  demoKind: string;
  name: string;
};

export type DemoSeedResult = DemoArtist & {
  alreadyExisted: boolean;
  spaceId: string;
  counts: {
    tracks: number;
    projects: number;
    tasks: number;
    sessions: number;
    feedback: number;
    events: number;
  };
};

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

export async function fetchDemoArtist(): Promise<DemoArtist | null> {
  const res = await fetch("/api/demo", { cache: "no-store" });
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.demo ?? null;
}

export async function seedDemo(): Promise<DemoSeedResult> {
  const res = await fetch("/api/demo", { method: "POST" });
  if (!res.ok) throw new Error(await readError(res, "Couldn't build the demo workspace."));
  return res.json();
}

export async function removeDemoWorkspace(
  artistId: string,
  options: { repeatTours?: boolean } = {}
): Promise<void> {
  const res = await fetch("/api/demo", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artistId, repeatTours: options.repeatTours === true }),
  });
  if (!res.ok) throw new Error(await readError(res, "Couldn't remove the demo workspace."));
}

/** Point this account at the demo for the navigation the user just requested. */
export function focusDemo(
  result: { artistId: string; spaceId: string },
  userId: string | null | undefined
): void {
  writeStoredArtistId(userId, result.artistId);
  if (result.spaceId) writeStoredSpaceId(userId, result.spaceId);
  try {
    // The provider consumes this once after the hard reload. Without an
    // explicit handoff, a Pro always resumes their own personal home.
    sessionStorage.setItem(PREFER_DEMO_ARTIST_KEY, result.artistId);
  } catch {
    /* The stored account pointer still lets this navigation proceed. */
  }
}

/**
 * Forget the demo pointers before reloading.
 *
 * Both have to go: leaving a deleted artist id behind sends the provider
 * looking for a row that no longer exists, and leaving the space id behind
 * points at a space that went with it.
 */
export function forgetDemo(): void {
  clearLegacyWorkspaceMemory();
}
