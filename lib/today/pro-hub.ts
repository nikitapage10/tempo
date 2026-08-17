export const WAITING_ON_YOU_LIMIT = 4;

export const WAITING_URGENCY_RANK = {
  overdue: 0,
  today: 1,
  review_requested: 2,
  upcoming: 3,
  open: 4,
} as const;

export type WaitingUrgency = keyof typeof WAITING_URGENCY_RANK;

export const WAITING_URGENCY_LABELS: Record<WaitingUrgency, string> = {
  overdue: "Overdue",
  today: "Due today",
  review_requested: "Review",
  upcoming: "Upcoming",
  open: "Open",
};

/** Assigned artist work only — personal-home tasks already sit in Open tasks. */
export function excludePersonalHomeWork<T extends { artistId: string }>(
  items: T[],
  personalHomeId: string | null | undefined
): T[] {
  if (!personalHomeId) return items;
  return items.filter((item) => item.artistId !== personalHomeId);
}

type WaitingSortable = {
  urgency: WaitingUrgency;
  dueAt: string | null;
  updatedAt: string;
};

function compareWaiting(a: WaitingSortable, b: WaitingSortable): number {
  const urgency = WAITING_URGENCY_RANK[a.urgency] - WAITING_URGENCY_RANK[b.urgency];
  if (urgency !== 0) return urgency;
  if (a.dueAt && b.dueAt && a.dueAt !== b.dueAt) {
    return a.dueAt.localeCompare(b.dueAt);
  }
  if (a.dueAt && !b.dueAt) return -1;
  if (!a.dueAt && b.dueAt) return 1;
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function rankWaitingOnYou<T extends WaitingSortable>(items: T[]): T[] {
  return [...items].sort(compareWaiting);
}

export function pickWaitingOnYou<T extends WaitingSortable>(
  items: T[],
  limit = WAITING_ON_YOU_LIMIT
): T[] {
  return rankWaitingOnYou(items).slice(0, limit);
}

/** First waiting item per artist, assuming `items` are already urgency-sorted. */
export function nextWorkByArtist<T extends { artistId: string }>(
  items: T[]
): Map<string, T> {
  const next = new Map<string, T>();
  for (const item of items) {
    if (!next.has(item.artistId)) next.set(item.artistId, item);
  }
  return next;
}

export type ProHubArtistSortKey = {
  name: string;
  overdue: number | null;
  hasWaitingWork: boolean;
};

/** Artists with overdue work and waiting handoffs rise first. */
export function sortProHubArtists<T extends ProHubArtistSortKey>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const overdueDelta = (b.overdue ?? 0) - (a.overdue ?? 0);
    if (overdueDelta !== 0) return overdueDelta;
    if (a.hasWaitingWork !== b.hasWaitingWork) return a.hasWaitingWork ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}