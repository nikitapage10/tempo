"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  Columns3,
  Disc3,
  FolderKanban,
  Hash,
  MessageCircle,
  MessagesSquare,
  Music2,
  StickyNote,
  UserRound,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { useActiveSpace } from "@/components/active-space-provider";
import { SpectraCoverArt } from "@/components/spectra/spectra-cover-art";
import { useSearchCatalog } from "@/hooks/use-search-catalog";
import {
  groupSearchHits,
  matchSearchCatalog,
  SEARCH_CATEGORY_LABELS,
  type SearchCategory,
  type SearchHit,
} from "@/lib/search/match";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<SearchCategory, LucideIcon> = {
  tracks: Music2,
  projects: FolderKanban,
  tasks: CheckSquare,
  people: UserRound,
  messages: MessagesSquare,
  notes: StickyNote,
  stages: Columns3,
  spaces: Disc3,
  posts: MessageCircle,
  scenes: Users2,
  pages: Hash,
};

const FILTER_OPTIONS: Array<{ id: SearchCategory | "all"; label: string }> = [
  { id: "all", label: "Everything" },
  { id: "tracks", label: "Tracks" },
  { id: "projects", label: "Projects" },
  { id: "tasks", label: "Tasks" },
  { id: "people", label: "People" },
  { id: "messages", label: "Messages" },
  { id: "posts", label: "Posts" },
  { id: "scenes", label: "Scenes" },
  { id: "notes", label: "Notes" },
  { id: "pages", label: "Go to" },
];

/**
 * Global typeahead with the animated glowing search chrome + grouped results
 * across the active artist's catalog.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const { setActiveSpaceId } = useActiveSpace();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const glowRef = React.useRef<HTMLDivElement>(null);

  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [category, setCategory] = React.useState<SearchCategory | "all">("all");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  // Speed up the glow's existing spin via playbackRate rather than swapping
  // animation-duration — changing duration mid-run jumps the rotation angle
  // (it recomputes cycle progress against the new length), which read as the
  // animation "restarting" on hover. playbackRate accelerates in place.
  // Driven only by actual mouse hover — tying it to focus as well meant the
  // spin stayed sped-up after the mouse left, since focus lingers on a
  // clicked input until something else is clicked. Focus still gets a visual
  // response (the halo below), just not the spin rate.
  React.useEffect(() => {
    if (reduceMotion) return;
    const el = glowRef.current;
    if (!el || typeof el.getAnimations !== "function") return;
    const rate = isHovered ? 3 : 1;
    el.getAnimations({ subtree: true }).forEach((animation) => {
      animation.playbackRate = rate;
    });
  }, [isHovered, reduceMotion]);

  const catalogQuery = useSearchCatalog(open || query.length > 0);
  const catalog = catalogQuery.data;

  const hits = React.useMemo(() => {
    if (!catalog || !query.trim()) return [];
    return matchSearchCatalog(catalog, query, { category });
  }, [catalog, query, category]);

  const groups = React.useMemo(() => groupSearchHits(hits), [hits]);
  const flatHits = hits;
  // Nothing matched the words as typed — the list is all near-misses, so say so
  // and point at the closest one.
  const didYouMean = hits.length > 0 && hits.every((hit) => hit.approximate) ? hits[0] : null;

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, category]);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open && !filterOpen) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, filterOpen]);

  function go(hit: SearchHit) {
    if (hit.spaceId) setActiveSpaceId(hit.spaceId);
    setOpen(false);
    setFilterOpen(false);
    setQuery("");
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else {
        setOpen(false);
        inputRef.current?.blur();
      }
      return;
    }
    if (!flatHits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatHits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatHits.length) % flatHits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flatHits[activeIndex];
      if (hit) go(hit);
    }
  }

  const showPanel = open && query.trim().length > 0;
  const placeholder =
    category === "all"
      ? "Search tracks, artists, details…"
      : `Search ${SEARCH_CATEGORY_LABELS[category].toLowerCase()}…`;

  return (
    <div
      ref={rootRef}
      className={cn("relative w-full max-w-[280px]", className)}
    >
      <div
        className="tempo-search-shell group relative flex items-center justify-center"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {!reduceMotion ? (
          <div aria-hidden ref={glowRef} className="search-glow">
            <div className="search-glow__layer search-glow__layer--a" />
            <div className="search-glow__layer search-glow__layer--b" />
            <div className="search-glow__layer search-glow__layer--c" />
            <div className="search-glow__layer search-glow__layer--d" />
          </div>
        ) : (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-input border border-line/80"
          />
        )}

        <div className="relative w-full">
          <label className="sr-only" htmlFor="tempo-global-search">
            Search your catalog
          </label>
          <input
            ref={inputRef}
            id="tempo-global-search"
            type="search"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={showPanel}
            aria-controls="tempo-search-results"
            aria-autocomplete="list"
            aria-activedescendant={
              showPanel && flatHits[activeIndex]
                ? `tempo-search-${flatHits[activeIndex].id}`
                : undefined
            }
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="relative z-[1] h-10 w-full rounded-input border-none bg-bg-0 py-2 pl-10 pr-10 text-sm text-text-hi placeholder:text-text-lo focus:outline-none focus-visible:ring-0"
          />

          <button
            type="button"
            id="filter-icon"
            aria-label="Filter search"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((v) => !v)}
            className="absolute right-1.5 top-1.5 z-[2] flex size-7 items-center justify-center rounded-input border border-line bg-bg-2 text-text-lo transition-colors hover:bg-bg-3 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
          >
            <svg
              preserveAspectRatio="none"
              height="16"
              width="16"
              viewBox="4.8 4.56 14.832 15.408"
              fill="none"
              aria-hidden
            >
              <path
                d="M8.16 6.65002H15.83C16.47 6.65002 16.99 7.17002 16.99 7.81002V9.09002C16.99 9.56002 16.7 10.14 16.41 10.43L13.91 12.64C13.56 12.93 13.33 13.51 13.33 13.98V16.48C13.33 16.83 13.1 17.29 12.81 17.47L12 17.98C11.24 18.45 10.2 17.92 10.2 16.99V13.91C10.2 13.5 9.97 12.98 9.73 12.69L7.52 10.36C7.23 10.08 7 9.55002 7 9.20002V7.87002C7 7.17002 7.52 6.65002 8.16 6.65002Z"
                stroke="currentColor"
                strokeWidth="1"
                strokeMiterlimit="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {category !== "all" ? (
              <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-amber" />
            ) : null}
          </button>

          <div
            aria-hidden
            id="search-icon"
            className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle
                stroke="url(#tempo-glow-search)"
                r="8"
                cy="11"
                cx="11"
              />
              <line
                stroke="url(#tempo-glow-search-l)"
                y2="16.65"
                y1="22"
                x2="16.65"
                x1="22"
              />
              <defs>
                <linearGradient
                  gradientTransform="rotate(50)"
                  id="tempo-glow-search"
                >
                  <stop stopColor="var(--ice)" offset="0%" />
                  <stop stopColor="var(--text-lo)" offset="50%" />
                </linearGradient>
                <linearGradient id="tempo-glow-search-l">
                  <stop stopColor="var(--text-lo)" offset="0%" />
                  <stop stopColor="var(--amber)" offset="50%" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {filterOpen ? (
        <div className="absolute right-0 z-[70] mt-2 w-full overflow-hidden rounded-card border border-line bg-bg-1 shadow-e3">
          <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
            {FILTER_OPTIONS.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={category === opt.id}
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-bg-2",
                    category === opt.id ? "text-ice" : "text-text-hi"
                  )}
                  onClick={() => {
                    setCategory(opt.id);
                    setFilterOpen(false);
                    inputRef.current?.focus();
                  }}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showPanel ? (
        <div
          id="tempo-search-results"
          role="listbox"
          className="absolute right-0 z-[70] mt-2 max-h-[min(420px,70vh)] w-[min(420px,calc(100vw-2rem))] overflow-y-auto rounded-card border border-line bg-bg-1 shadow-e3"
        >
          {catalogQuery.isLoading ? (
            <p className="px-3 py-4 text-sm text-text-lo">
              Looking through your catalog…
            </p>
          ) : catalogQuery.isError ? (
            <p className="px-3 py-4 text-sm text-warn">
              Couldn’t load search. Try again in a moment.
            </p>
          ) : flatHits.length === 0 ? (
            <p className="px-3 py-4 text-sm text-text-lo">
              Nothing matches “{query.trim()}”.
            </p>
          ) : (
            <>
            {didYouMean ? (
              <p className="border-b border-line bg-bg-2/40 px-3 py-2 text-xs leading-relaxed text-text-lo">
                No exact match for “{query.trim()}”. Did you mean{" "}
                <button
                  type="button"
                  onClick={() => go(didYouMean)}
                  className="text-ice hover:underline"
                >
                  {didYouMean.title}
                </button>
                ?
              </p>
            ) : null}
            {groups.map((group) => (
              <div
                key={group.category}
                className="border-b border-line last:border-b-0"
              >
                <h2 className="sticky top-0 bg-bg-1/95 px-3 py-1.5 font-data text-[10px] uppercase tracking-[0.08em] text-text-lo backdrop-blur-sm">
                  {group.label}
                </h2>
                <ul>
                  {group.hits.map((hit) => {
                    const flatIdx = flatHits.indexOf(hit);
                    const active = flatIdx === activeIndex;
                    const Icon = CATEGORY_ICONS[hit.category];
                    return (
                      <li key={hit.id} role="option" aria-selected={active}>
                        <button
                          type="button"
                          id={`tempo-search-${hit.id}`}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                            active ? "bg-bg-2" : "hover:bg-bg-2/70"
                          )}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          onClick={() => go(hit)}
                        >
                          {hit.category === "tracks" ? (
                            <span className="relative size-8 shrink-0 overflow-hidden rounded-input bg-bg-2">
                              <SpectraCoverArt
                                trackId={hit.id.replace(/^track:/, "")}
                                title={hit.title}
                                artworkUrl={hit.artworkUrl}
                                animate={false}
                              />
                            </span>
                          ) : (
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-input bg-bg-2 text-text-lo">
                              <Icon className="size-3.5" strokeWidth={1.75} />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-text-hi">
                              {hit.title}
                            </span>
                            <span className="block truncate font-data text-[11px] text-text-lo">
                              {hit.subtitle}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
