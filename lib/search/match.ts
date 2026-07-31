import type {
  SearchCatalog,
  SearchNote,
  SearchProject,
  SearchStage,
  SearchTask,
  SearchTrack,
} from "@/lib/api/search-catalog";
import type { Person } from "@/lib/types";

export type SearchCategory =
  | "tracks"
  | "projects"
  | "tasks"
  | "people"
  | "notes"
  | "stages"
  | "spaces"
  | "pages";

export const SEARCH_CATEGORY_LABELS: Record<SearchCategory, string> = {
  tracks: "Tracks",
  projects: "Projects",
  tasks: "Tasks",
  people: "People",
  notes: "Board notes",
  stages: "Stages",
  spaces: "Spaces",
  pages: "Go to",
};

export type SearchHit = {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  href: string;
  score: number;
  spaceId?: string | null;
  artworkUrl?: string | null;
};

export type SearchPageDef = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  keywords: string[];
};

export const SEARCH_PAGES: SearchPageDef[] = [
  {
    id: "page-today",
    title: "Today",
    subtitle: "What’s due and what needs attention",
    href: "/",
    keywords: ["today", "home", "dashboard", "due"],
  },
  {
    id: "page-board",
    title: "Board",
    subtitle: "Kanban stages for this space",
    href: "/board",
    keywords: ["board", "kanban", "pipeline", "stages"],
  },
  {
    id: "page-tracks",
    title: "Tracks",
    subtitle: "Full track list",
    href: "/tracks",
    keywords: ["tracks", "songs", "catalog", "list"],
  },
  {
    id: "page-projects",
    title: "Projects",
    subtitle: "EPs, albums, and packs",
    href: "/projects",
    keywords: ["projects", "ep", "album", "release"],
  },
  {
    id: "page-tasks",
    title: "Tasks",
    subtitle: "To-dos for this space",
    href: "/tasks",
    keywords: ["tasks", "todo", "to-do", "checklist"],
  },
  {
    id: "page-artist",
    title: "Artist",
    subtitle: "Your public profile and branding",
    href: "/artist",
    keywords: ["artist", "profile", "bio", "branding"],
  },
  {
    id: "page-social",
    title: "Social",
    subtitle: "Network, feed, and orbit",
    href: "/social",
    keywords: ["social", "network", "feed", "people", "contacts"],
  },
  {
    id: "page-messages",
    title: "Messages",
    subtitle: "Direct messages",
    href: "/messages",
    keywords: ["messages", "dm", "chat", "inbox"],
  },
  {
    id: "page-stats",
    title: "Stats",
    subtitle: "Numbers across every space",
    href: "/stats",
    keywords: ["stats", "statistics", "analytics", "numbers"],
  },
  {
    id: "page-settings",
    title: "Settings",
    subtitle: "Spaces, artists, import, account",
    href: "/settings",
    keywords: ["settings", "preferences", "import", "account"],
  },
];

const CATEGORY_ORDER: SearchCategory[] = [
  "tracks",
  "projects",
  "tasks",
  "people",
  "notes",
  "stages",
  "spaces",
  "pages",
];

const PER_CATEGORY_LIMIT = 6;
const TOTAL_LIMIT = 28;

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function includes(hay: string | null | undefined, needle: string): boolean {
  if (!hay || !needle) return false;
  return normalize(hay).includes(needle);
}

function scoreField(
  value: string | null | undefined,
  q: string,
  weight: number
): number {
  if (!value) return 0;
  const v = normalize(value);
  if (v === q) return weight * 3;
  if (v.startsWith(q)) return weight * 2;
  if (v.includes(q)) return weight;
  return 0;
}

function scoreTokens(
  fields: Array<{ value: string | null | undefined; weight: number }>,
  tokens: string[]
): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];
  for (const token of tokens) {
    let best = 0;
    let bestLabel = "";
    for (const { value, weight } of fields) {
      if (!value) continue;
      const s = scoreField(value, token, weight);
      if (s > best) {
        best = s;
        bestLabel = value;
      }
    }
    if (best === 0) return { score: 0, matched: [] };
    score += best;
    if (bestLabel && !matched.includes(bestLabel)) matched.push(bestLabel);
  }
  return { score, matched };
}

function parseBpmQuery(raw: string): number | null {
  const n = normalize(raw);
  const bpmSuffix = n.match(/^(\d+(?:\.\d+)?)\s*bpm$/);
  if (bpmSuffix) return Number(bpmSuffix[1]);
  if (/^\d{2,3}(?:\.\d)?$/.test(n)) return Number(n);
  return null;
}

function trackHit(t: SearchTrack, q: string, tokens: string[]): SearchHit | null {
  const bpmQ = parseBpmQuery(q);
  let score = 0;
  const reasons: string[] = [];

  if (bpmQ != null && t.bpm != null) {
    const diff = Math.abs(t.bpm - bpmQ);
    if (diff < 0.05) {
      score += 120;
      reasons.push(`${t.bpm} BPM`);
    } else if (diff <= 2) {
      score += 70;
      reasons.push(`${t.bpm} BPM`);
    }
  }

  const { score: fieldScore } = scoreTokens(
    [
      { value: t.title, weight: 40 },
      { value: t.artist_alias, weight: 28 },
      { value: t.genre, weight: 18 },
      { value: t.musical_key, weight: 22 },
      { value: t.destination, weight: 14 },
      { value: t.type, weight: 12 },
      { value: t.momentum, weight: 10 },
      { value: t.next_action, weight: 16 },
      { value: t.waiting_on, weight: 16 },
      { value: t.blocked_reason, weight: 14 },
      { value: t.notes, weight: 10 },
      { value: t.space_name, weight: 8 },
      { value: t.tags.join(" "), weight: 16 },
      {
        value: t.bpm != null ? `${t.bpm} bpm ${t.bpm}` : null,
        weight: 24,
      },
    ],
    tokens
  );
  score += fieldScore;

  // Tag exact token hits
  for (const tag of t.tags) {
    if (tokens.some((tok) => normalize(tag) === tok || includes(tag, tok))) {
      score += 18;
      if (!reasons.includes(`#${tag}`)) reasons.push(`#${tag}`);
    }
  }

  if (score <= 0) return null;

  const meta = [
    t.artist_alias,
    t.bpm != null ? `${t.bpm} BPM` : null,
    t.musical_key,
    t.genre,
    t.space_name,
  ].filter(Boolean) as string[];

  const subtitle =
    reasons.length > 0
      ? [...reasons.slice(0, 2), ...meta.filter((m) => !reasons.includes(m))].slice(0, 4).join(" · ")
      : meta.join(" · ") || t.type;

  return {
    id: `track:${t.id}`,
    category: "tracks",
    title: t.title,
    subtitle,
    href: `/track/${t.id}`,
    score,
    spaceId: t.space_id,
    artworkUrl: t.artwork_url,
  };
}

function projectHit(
  p: SearchProject,
  tokens: string[]
): SearchHit | null {
  const { score } = scoreTokens(
    [
      { value: p.name, weight: 40 },
      { value: p.description, weight: 14 },
      { value: p.project_type, weight: 16 },
      { value: p.status, weight: 8 },
      { value: p.space_name, weight: 8 },
    ],
    tokens
  );
  if (score <= 0) return null;
  return {
    id: `project:${p.id}`,
    category: "projects",
    title: p.name,
    subtitle: [p.project_type, p.status, p.space_name].filter(Boolean).join(" · "),
    href: `/projects/${p.id}`,
    score,
    spaceId: p.space_id,
  };
}

function taskHit(t: SearchTask, tokens: string[]): SearchHit | null {
  const { score } = scoreTokens(
    [
      { value: t.title, weight: 40 },
      { value: t.notes, weight: 14 },
      { value: t.category, weight: 16 },
      { value: t.status, weight: 10 },
      { value: t.space_name, weight: 8 },
    ],
    tokens
  );
  if (score <= 0) return null;
  return {
    id: `task:${t.id}`,
    category: "tasks",
    title: t.title,
    subtitle: [t.category, t.status, t.space_name].filter(Boolean).join(" · "),
    href: "/tasks",
    score,
    spaceId: t.space_id,
  };
}

function personHit(p: Person, tokens: string[]): SearchHit | null {
  const { score } = scoreTokens(
    [
      { value: p.display_name, weight: 40 },
      { value: p.primary_email, weight: 22 },
      { value: p.notes, weight: 10 },
      { value: p.roles.join(" "), weight: 16 },
      { value: p.tags.join(" "), weight: 14 },
      { value: p.linked_profile?.handle, weight: 24 },
      { value: p.linked_profile?.display_name, weight: 20 },
      { value: p.source, weight: 8 },
    ],
    tokens
  );
  if (score <= 0) return null;

  const handle = p.linked_profile?.handle;
  const href = handle
    ? `/artist/${handle}`
    : "/social";

  return {
    id: `person:${p.id}`,
    category: "people",
    title: p.display_name,
    subtitle: [
      handle ? `@${handle}` : null,
      p.roles.slice(0, 2).join(", ") || null,
      p.source.replace(/_/g, " "),
    ]
      .filter(Boolean)
      .join(" · "),
    href,
    score,
    artworkUrl: p.avatar_url ?? p.linked_profile?.emblem_url ?? null,
  };
}

function noteHit(n: SearchNote, tokens: string[]): SearchHit | null {
  const { score } = scoreTokens(
    [
      { value: n.title, weight: 40 },
      { value: n.body, weight: 18 },
      { value: n.stage_name, weight: 12 },
      { value: n.space_name, weight: 8 },
    ],
    tokens
  );
  if (score <= 0) return null;
  return {
    id: `note:${n.id}`,
    category: "notes",
    title: n.title,
    subtitle: [n.stage_name, n.space_name].filter(Boolean).join(" · "),
    href: "/board",
    score,
    spaceId: n.space_id,
  };
}

function stageHit(s: SearchStage, tokens: string[]): SearchHit | null {
  const { score } = scoreTokens(
    [
      { value: s.name, weight: 36 },
      { value: s.space_name, weight: 10 },
      { value: "stage pipeline board", weight: 6 },
    ],
    tokens
  );
  if (score <= 0) return null;
  return {
    id: `stage:${s.id}`,
    category: "stages",
    title: s.name,
    subtitle: `Stage · ${s.space_name}`,
    href: "/board",
    score,
    spaceId: s.space_id,
  };
}

function spaceHit(
  sp: SearchCatalog["spaces"][number],
  tokens: string[]
): SearchHit | null {
  const { score } = scoreTokens(
    [
      { value: sp.name, weight: 40 },
      { value: sp.focus, weight: 12 },
      { value: "space workspace", weight: 6 },
    ],
    tokens
  );
  if (score <= 0) return null;
  return {
    id: `space:${sp.id}`,
    category: "spaces",
    title: sp.name,
    subtitle: sp.focus === "tasks" ? "Tasks-focused space" : "Music space",
    href: sp.focus === "tasks" ? "/tasks" : "/board",
    score,
    spaceId: sp.id,
  };
}

function pageHit(page: SearchPageDef, tokens: string[]): SearchHit | null {
  const { score } = scoreTokens(
    [
      { value: page.title, weight: 36 },
      { value: page.subtitle, weight: 12 },
      { value: page.keywords.join(" "), weight: 20 },
    ],
    tokens
  );
  if (score <= 0) return null;
  return {
    id: page.id,
    category: "pages",
    title: page.title,
    subtitle: page.subtitle,
    href: page.href,
    score,
  };
}

export type MatchOptions = {
  /** Limit to one category (filter chip). */
  category?: SearchCategory | "all";
  limit?: number;
};

/**
 * Ranked, category-aware search over a preloaded catalog.
 * Pure — safe to call on every keystroke.
 */
export function matchSearchCatalog(
  catalog: SearchCatalog,
  query: string,
  opts: MatchOptions = {}
): SearchHit[] {
  const q = normalize(query);
  if (q.length < 1) return [];

  const tokens = q.split(" ").filter(Boolean);
  if (!tokens.length) return [];

  const category = opts.category ?? "all";
  const hits: SearchHit[] = [];

  const allow = (c: SearchCategory) => category === "all" || category === c;

  if (allow("tracks")) {
    for (const t of catalog.tracks) {
      const hit = trackHit(t, q, tokens);
      if (hit) hits.push(hit);
    }
  }
  if (allow("projects")) {
    for (const p of catalog.projects) {
      const hit = projectHit(p, tokens);
      if (hit) hits.push(hit);
    }
  }
  if (allow("tasks")) {
    for (const t of catalog.tasks) {
      const hit = taskHit(t, tokens);
      if (hit) hits.push(hit);
    }
  }
  if (allow("people")) {
    for (const p of catalog.people) {
      const hit = personHit(p, tokens);
      if (hit) hits.push(hit);
    }
  }
  if (allow("notes")) {
    for (const n of catalog.notes) {
      const hit = noteHit(n, tokens);
      if (hit) hits.push(hit);
    }
  }
  if (allow("stages")) {
    for (const s of catalog.stages) {
      const hit = stageHit(s, tokens);
      if (hit) hits.push(hit);
    }
  }
  if (allow("spaces")) {
    for (const sp of catalog.spaces) {
      const hit = spaceHit(sp, tokens);
      if (hit) hits.push(hit);
    }
  }
  if (allow("pages")) {
    for (const page of SEARCH_PAGES) {
      const hit = pageHit(page, tokens);
      if (hit) hits.push(hit);
    }
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  // Cap per category, then overall — keeps groups readable.
  const seen = new Map<SearchCategory, number>();
  const limited: SearchHit[] = [];
  for (const hit of hits) {
    const n = seen.get(hit.category) ?? 0;
    if (n >= PER_CATEGORY_LIMIT) continue;
    seen.set(hit.category, n + 1);
    limited.push(hit);
    if (limited.length >= (opts.limit ?? TOTAL_LIMIT)) break;
  }
  return limited;
}

export function groupSearchHits(
  hits: SearchHit[]
): Array<{ category: SearchCategory; label: string; hits: SearchHit[] }> {
  const byCat = new Map<SearchCategory, SearchHit[]>();
  for (const hit of hits) {
    const list = byCat.get(hit.category) ?? [];
    list.push(hit);
    byCat.set(hit.category, list);
  }
  return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((category) => ({
    category,
    label: SEARCH_CATEGORY_LABELS[category],
    hits: byCat.get(category)!,
  }));
}
