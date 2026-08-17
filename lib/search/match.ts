import type {
  SearchCatalog,
  SearchNote,
  SearchPost,
  SearchProject,
  SearchScene,
  SearchStage,
  SearchTask,
  SearchTrack,
} from "@/lib/api/search-catalog";
import { parseSearchQuery, type ParsedSearchQuery } from "@/lib/search/parse-query";
import type { Person } from "@/lib/types";

export type SearchCategory =
  | "tracks"
  | "projects"
  | "tasks"
  | "people"
  | "messages"
  | "notes"
  | "stages"
  | "spaces"
  | "posts"
  | "scenes"
  | "pages";

export const SEARCH_CATEGORY_LABELS: Record<SearchCategory, string> = {
  tracks: "Tracks",
  projects: "Projects",
  tasks: "Tasks",
  people: "People",
  messages: "Messages",
  notes: "Board notes",
  stages: "Stages",
  spaces: "Spaces",
  posts: "Posts",
  scenes: "Scenes",
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
  /** True when the query only matched loosely — a typo or a missing word. */
  approximate?: boolean;
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
    subtitle: "Visual workflow for this space",
    href: "/board",
    keywords: ["board", "kanban", "pipeline", "stages", "workflow", "status"],
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
    id: "page-scenes",
    title: "Scenes",
    subtitle: "Rooms for the people you make music with",
    href: "/scenes",
    keywords: ["scenes", "community", "communities", "group", "label", "school", "crew"],
  },
  {
    id: "page-messages",
    title: "Messages",
    subtitle: "Direct messages and group chats",
    href: "/messages",
    keywords: ["messages", "dm", "chat", "inbox", "group"],
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
  "messages",
  "posts",
  "scenes",
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

/** Longest typo budget we ever allow — keeps the DP below cheap. */
const MAX_EDITS = 2;

/**
 * Levenshtein distance, abandoned as soon as it can't come in at or under
 * `max`. Only ever called on short strings (a query token vs. one word).
 */
function editDistanceWithin(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      row.push(value);
      if (value < rowBest) rowBest = value;
    }
    if (rowBest > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/** One typo per 4 characters, so short words stay strict. */
function editBudget(token: string): number {
  if (token.length < 4) return 0;
  return Math.min(MAX_EDITS, Math.floor(token.length / 4));
}

/**
 * Near-miss match for misspellings and half-remembered names: compares the
 * token against each word of the field. Skips long free-text fields (notes,
 * transcripts) so every keystroke stays cheap — fuzzy is for names and titles.
 */
function fuzzyFieldScore(value: string, token: string, weight: number): number {
  const budget = editBudget(token);
  if (!budget || value.length > 120) return 0;
  let best = 0;
  const words = value.split(" ");
  for (let i = 0; i < words.length && i < 24; i += 1) {
    const word = words[i];
    if (!word || Math.abs(word.length - token.length) > budget) continue;
    const distance = editDistanceWithin(token, word, budget);
    if (distance > budget) continue;
    // Closer spellings rank higher, but never above a real substring hit.
    const closeness = distance === 1 ? 0.6 : 0.4;
    best = Math.max(best, weight * closeness);
  }
  return best;
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
  return fuzzyFieldScore(v, q, weight);
}

/**
 * How many query words are allowed to miss entirely — one, plus one more for
 * every three words. Enough that "fade from dust" still finds "Fade to Dust"
 * and "battle scars" still surfaces "Battle Wounds" (as a suggestion), without
 * a single shared word dragging in the whole catalog.
 */
function missBudget(tokenCount: number): number {
  return tokenCount >= 2 ? Math.max(1, Math.floor(tokenCount / 3)) : 0;
}

function scoreTokens(
  fields: Array<{ value: string | null | undefined; weight: number }>,
  tokens: string[]
): { score: number; matched: string[] } {
  let score = 0;
  let hits = 0;
  let misses = 0;
  const allowedMisses = missBudget(tokens.length);
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
    if (best === 0) {
      misses += 1;
      if (misses > allowedMisses) return { score: 0, matched: [] };
      continue;
    }
    hits += 1;
    score += best;
    if (bestLabel && !matched.includes(bestLabel)) matched.push(bestLabel);
  }
  if (!hits) return { score: 0, matched: [] };
  // A partial match still ranks below the same query matching in full.
  return { score: score * (hits / tokens.length), matched };
}

function trackHit(t: SearchTrack, parsed: ParsedSearchQuery): SearchHit | null {
  let score = 0;
  const reasons: string[] = [];

  if (parsed.bpm) {
    if (t.bpm == null) return null;
    if (parsed.bpm.kind === "exact") {
      const diff = Math.abs(t.bpm - parsed.bpm.bpm);
      if (diff < 0.05) {
        score += 120;
        reasons.push(`${t.bpm} BPM`);
      } else if (diff <= 2) {
        score += 70;
        reasons.push(`~${t.bpm} BPM`);
      } else {
        return null;
      }
    } else if (t.bpm >= parsed.bpm.min && t.bpm <= parsed.bpm.max) {
      score += 120;
      reasons.push(`${t.bpm} BPM`);
    } else {
      return null;
    }
  }

  const tokens = parsed.textTokens;
  if (tokens.length > 0) {
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
        // Number only — never the word "bpm", so lone "bpm" can't match every
        // timed track. Structured BPM queries use parsed.bpm above.
        { value: t.bpm != null ? String(t.bpm) : null, weight: 24 },
      ],
      tokens
    );
    if (fieldScore <= 0) return null;
    score += fieldScore;

    for (const tag of t.tags) {
      if (
        tokens.some((tok) => normalize(tag) === tok || includes(tag, tok))
      ) {
        score += 18;
        if (!reasons.includes(`#${tag}`)) reasons.push(`#${tag}`);
      }
    }
  } else if (!parsed.bpm) {
    return null;
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
      ? [...reasons.slice(0, 2), ...meta.filter((m) => !reasons.includes(m))]
          .slice(0, 4)
          .join(" · ")
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

function postHit(p: SearchPost, tokens: string[]): SearchHit | null {
  const { score } = scoreTokens(
    [
      { value: p.body, weight: 32 },
      { value: p.author_display_name, weight: 24 },
      { value: p.author_handle, weight: 20 },
      { value: p.attachment_snapshot?.title, weight: 16 },
    ],
    tokens
  );
  if (score <= 0) return null;

  const title =
    p.body?.trim() ||
    (p.attachment_snapshot?.title
      ? `Shared “${p.attachment_snapshot.title}”`
      : "Post");

  const posted = new Date(p.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return {
    id: `post:${p.id}`,
    category: "posts",
    title,
    subtitle: [
      p.author_display_name ?? (p.author_handle ? `@${p.author_handle}` : null),
      posted,
    ]
      .filter(Boolean)
      .join(" · "),
    href: `/social?post=${p.id}`,
    score,
    artworkUrl: p.author_emblem_url,
  };
}

function sceneHit(sc: SearchScene, tokens: string[]): SearchHit | null {
  const { score } = scoreTokens(
    [
      { value: sc.name, weight: 40 },
      { value: sc.tagline, weight: 20 },
      { value: sc.kind, weight: 8 },
      { value: "scene community room", weight: 4 },
    ],
    tokens
  );
  if (score <= 0) return null;
  return {
    id: `scene:${sc.id}`,
    category: "scenes",
    title: sc.name,
    subtitle: sc.tagline ?? "Scene",
    href: `/scenes/${sc.slug}`,
    score,
    artworkUrl: sc.emblem_url,
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

function messageHit(
  thread: SearchCatalog["messages"][number],
  tokens: string[]
): SearchHit | null {
  const { score } = scoreTokens(
    [
      { value: thread.title, weight: 34 },
      { value: thread.handle ?? "", weight: 26 },
      { value: thread.preview, weight: 16 },
      { value: thread.transcript, weight: 10 },
      { value: thread.kind === "support" ? "support ticket help tempo" : "message dm conversation group chat", weight: 8 },
    ],
    tokens
  );
  if (score <= 0) return null;
  const param = thread.kind === "support" ? `support=${thread.id}` : `c=${thread.id}`;
  return {
    id: `message:${thread.kind}:${thread.id}`,
    category: "messages",
    title: thread.kind === "support" ? `TEMPO Support · ${thread.title}` : thread.title,
    // Archived threads stay searchable, so the label says where it landed.
    subtitle: `${thread.archived ? "Archived · " : ""}${thread.preview}`.slice(0, 120),
    href: `/messages?${param}${thread.archived ? "&archived=1" : ""}`,
    score,
    artworkUrl: thread.emblem_url,
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
  const parsed = parseSearchQuery(query);
  if (!parsed.normalized) return [];

  const tokens = parsed.textTokens;
  // BPM-only queries still search tracks; other categories need text tokens.
  if (!tokens.length && !parsed.bpm) return [];

  const category = opts.category ?? "all";
  const hits: SearchHit[] = [];

  const allow = (c: SearchCategory) => category === "all" || category === c;

  if (allow("tracks")) {
    for (const t of catalog.tracks) {
      const hit = trackHit(t, parsed);
      if (hit) hits.push(hit);
    }
  }
  if (tokens.length > 0) {
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
    if (allow("messages")) {
      for (const thread of catalog.messages ?? []) {
        const hit = messageHit(thread, tokens);
        if (hit) hits.push(hit);
      }
    }
    if (allow("posts")) {
      for (const p of catalog.posts) {
        const hit = postHit(p, tokens);
        if (hit) hits.push(hit);
      }
    }
    if (allow("scenes")) {
      for (const sc of catalog.scenes ?? []) {
        const hit = sceneHit(sc, tokens);
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
  // Flag only the distant matches, so the UI can offer "did you mean…" when
  // the guess is a real stretch — not for a typo or one small wrong word.
  return limited.map((hit) => ({
    ...hit,
    approximate: matchCloseness(hit, tokens) < APPROXIMATE_THRESHOLD,
  }));
}

/** Below this share of the query landing on the result, we offer a suggestion. */
const APPROXIMATE_THRESHOLD = 0.6;

/**
 * How much of what the user typed actually shows up in the result, 0–1.
 * A word that's there counts fully; a word that's one typo away counts most of
 * the way; a word that's simply absent counts for nothing. So "fade from dust"
 * against "Fade to Dust" scores well (two of three words are right there),
 * while "battle scars" against "Battle Wounds" does not.
 */
function matchCloseness(hit: SearchHit, tokens: string[]): number {
  if (!tokens.length) return 1;
  const haystack = normalize(`${hit.title} ${hit.subtitle}`);
  const words = haystack.split(" ").slice(0, 40);
  let covered = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      covered += 1;
      continue;
    }
    const budget = editBudget(token);
    if (budget && words.some((word) => editDistanceWithin(token, word, budget) <= budget)) {
      covered += 0.75;
    }
  }
  return covered / tokens.length;
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
