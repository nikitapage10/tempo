/**
 * Pure Pulse item normalization, priority, dedupe, and category rules —
 * 01-PRODUCT-AND-UX-SPEC.md §8, 02-TECHNICAL-AND-DATA-DESIGN.md §6. No AI
 * ranking, ever (§6.3) — ordering is fully deterministic and explainable.
 */

export type PulseCategory =
  | "due"
  | "attention"
  | "collaboration"
  | "feedback"
  | "messages"
  | "calendar"
  | "progress"
  | "product";

export type PulseUrgency = "critical" | "today" | "soon" | "awareness";
export type PulseSensitivity = "generic" | "entity_name" | "never_email";

export type RawPulseItem = {
  dedupeIdentity: string;
  category: PulseCategory;
  urgency: PulseUrgency;
  occurredAt?: string;
  dueAt?: string;
  genericLabel: string;
  namedLabel?: string;
  count: number;
  reasonCode: string;
  destination: string;
  sensitivity: PulseSensitivity;
  /** Set by the caller when this item duplicates something Today already shows. */
  alreadyRepresentedOnToday?: boolean;
};

const URGENCY_RANK: Record<PulseUrgency, number> = {
  critical: 0,
  today: 1,
  soon: 2,
  awareness: 3,
};

/** Section headings in the digest, in the order they are read. */
export const PULSE_CATEGORY_LABELS: Record<PulseCategory, string> = {
  attention: "Needs attention",
  due: "Due",
  feedback: "Feedback",
  collaboration: "Collaboration",
  calendar: "Calendar",
  messages: "Messages",
  progress: "Progress",
  product: "From TEMPO",
};

const CATEGORY_PRIORITY: Record<PulseCategory, number> = {
  attention: 0,
  due: 1,
  feedback: 2,
  collaboration: 3,
  calendar: 4,
  messages: 5,
  progress: 6,
  product: 7,
};

function sortKey(item: RawPulseItem): string {
  const time = item.dueAt ?? item.occurredAt ?? "";
  return [
    URGENCY_RANK[item.urgency],
    time,
    CATEGORY_PRIORITY[item.category],
    item.dedupeIdentity,
  ]
    .map((v) => String(v).padStart(20, "0"))
    .join("|");
}

/** Deterministic sort — same input always yields the same order. */
export function sortPulseItems(items: RawPulseItem[]): RawPulseItem[] {
  return [...items].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

/** Collapses duplicate dedupeIdentity, keeping the highest-urgency instance. */
export function dedupePulseItems(items: RawPulseItem[]): RawPulseItem[] {
  const byId = new Map<string, RawPulseItem>();
  for (const item of items) {
    const existing = byId.get(item.dedupeIdentity);
    if (!existing || URGENCY_RANK[item.urgency] < URGENCY_RANK[existing.urgency]) {
      byId.set(item.dedupeIdentity, item);
    }
  }
  return Array.from(byId.values());
}

/** Marks items whose dedupeIdentity already appears in a Today surface (Tasks due / Needs attention). */
export function markAlreadyOnToday(
  items: RawPulseItem[],
  alreadyShownIdentities: ReadonlySet<string>
): RawPulseItem[] {
  return items.map((item) =>
    alreadyShownIdentities.has(item.dedupeIdentity)
      ? { ...item, alreadyRepresentedOnToday: true }
      : item
  );
}

export type InAppPulseResult = {
  headline: string | null;
  items: RawPulseItem[];
  caughtUp: boolean;
};

const IN_APP_MAX_ROWS = 3;

/**
 * Builds the in-app Today Pulse module's content: dedupe, exclude anything
 * already visible elsewhere on Today, sort, cap at 3 (§8.6). If nothing is
 * left, report caughtUp rather than an empty/awkward module.
 */
export function buildInAppPulse(
  rawItems: RawPulseItem[],
  alreadyShownIdentities: ReadonlySet<string>
): InAppPulseResult {
  const deduped = dedupePulseItems(rawItems);
  const marked = markAlreadyOnToday(deduped, alreadyShownIdentities);
  const eligible = marked.filter((item) => !item.alreadyRepresentedOnToday);
  const sorted = sortPulseItems(eligible);
  const capped = sorted.slice(0, IN_APP_MAX_ROWS);

  if (capped.length === 0) {
    return { headline: null, items: [], caughtUp: true };
  }

  const headline =
    capped.length === 1
      ? "One thing changed while you were away"
      : `${capped.length} things changed while you were away`;

  return { headline, items: capped, caughtUp: false };
}

export type DigestSection = { category: PulseCategory; items: RawPulseItem[]; overflowCount: number };

const MAX_DETAILED_PER_SECTION = 5;

/** Groups items by category for email digest composition, capping detail per §8.4. */
export function buildDigestSections(
  rawItems: RawPulseItem[],
  categoryOrder: PulseCategory[]
): DigestSection[] {
  const deduped = sortPulseItems(dedupePulseItems(rawItems));
  const sections: DigestSection[] = [];
  for (const category of categoryOrder) {
    const inCategory = deduped.filter((i) => i.category === category);
    if (inCategory.length === 0) continue;
    sections.push({
      category,
      items: inCategory.slice(0, MAX_DETAILED_PER_SECTION),
      overflowCount: Math.max(0, inCategory.length - MAX_DETAILED_PER_SECTION),
    });
  }
  return sections;
}

/** True only when there is nothing actionable — daily digests must not send in this case (§8.4). */
export function isDigestEmpty(sections: DigestSection[]): boolean {
  return sections.every((s) => s.items.length === 0 && s.overflowCount === 0);
}

/** Applies the account-wide email privacy default: generic labels unless the member opted in. */
export function labelForEmail(item: RawPulseItem, includeEntityNames: boolean): string {
  if (item.sensitivity === "never_email") return item.genericLabel;
  if (includeEntityNames && item.namedLabel && item.sensitivity === "entity_name") {
    return item.namedLabel;
  }
  return item.genericLabel;
}
