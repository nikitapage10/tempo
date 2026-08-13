/**
 * When a team member redeems an artist invite, Origin must run on a music
 * artist — never on their personal/manager home.
 */

export type OriginOwnedRow = {
  id: string;
  user_id?: string | null;
  workspace_kind?: string | null;
  origin_status?: string | null;
};

function isPersonal(row: OriginOwnedRow): boolean {
  return row.workspace_kind === "personal";
}

function isFinishedMusic(status: string | null | undefined): boolean {
  return status === "complete" || status === "skipped";
}

function isUnfinishedMusic(status: string | null | undefined): boolean {
  return status === "not_started" || status === "in_progress";
}

export function musicOwnedRows(owned: OriginOwnedRow[]): OriginOwnedRow[] {
  return owned.filter((row) => !isPersonal(row));
}

/**
 * Team-only leftover Artist rows (email-named, never Origin) must not trap a
 * manager in onboarding. A later artist invite mints a second unfinished
 * music row (or sits beside a personal home) — those must go to Origin.
 */
export function shouldSendToOrigin(input: {
  owned: OriginOwnedRow[];
  hasMembership: boolean;
}): boolean {
  const music = musicOwnedRows(input.owned);
  const unfinished = music.filter((row) => isUnfinishedMusic(row.origin_status ?? null));
  const hasPersonalHome = input.owned.some(isPersonal);
  const finishedMusician = music.some((row) => isFinishedMusic(row.origin_status ?? null));

  if (unfinished.length === 0) {
    return music.length === 0 && !hasPersonalHome && !input.hasMembership;
  }

  const leftoverTrap =
    input.hasMembership &&
    !hasPersonalHome &&
    !finishedMusician &&
    music.length === 1 &&
    unfinished[0]?.origin_status === "not_started";
  return !leftoverTrap;
}

export type OriginArtistPlan = {
  reuseId: string | null;
  startOrigin: boolean;
  convertToPersonalIds: string[];
};

/**
 * Decide whether to resume, convert leftovers into a personal home, or mint
 * a new music artist for Origin.
 */
export function planOriginArtistForInvite(
  owned: OriginOwnedRow[],
  hasMembership: boolean
): OriginArtistPlan {
  const music = musicOwnedRows(owned);
  const finished = music.find((row) => isFinishedMusic(row.origin_status ?? null));
  if (finished) {
    return { reuseId: finished.id, startOrigin: false, convertToPersonalIds: [] };
  }

  const inProgress = music.find((row) => row.origin_status === "in_progress");
  if (inProgress) {
    return { reuseId: inProgress.id, startOrigin: true, convertToPersonalIds: [] };
  }

  const hasPersonal = owned.some(isPersonal);
  const notStarted = music.filter((row) => row.origin_status === "not_started");

  if (hasPersonal) {
    return {
      reuseId: notStarted[0]?.id ?? null,
      startOrigin: true,
      convertToPersonalIds: [],
    };
  }

  if (hasMembership && notStarted.length > 0) {
    return {
      reuseId: null,
      startOrigin: true,
      convertToPersonalIds: notStarted.map((row) => row.id),
    };
  }

  return {
    reuseId: notStarted[0]?.id ?? null,
    startOrigin: true,
    convertToPersonalIds: [],
  };
}

/** The owned music artist Origin should run on — not the manager home. */
export function pickOriginArtistId(
  rows: OriginOwnedRow[],
  userId: string | null | undefined
): string | null {
  if (!userId) return null;
  const owned = rows.filter((row) => !row.user_id || row.user_id === userId);
  const music = musicOwnedRows(owned);
  const inProgress = music.find((row) => row.origin_status === "in_progress");
  if (inProgress) return inProgress.id;
  const notStarted = music.find((row) => row.origin_status === "not_started");
  return notStarted?.id ?? null;
}
