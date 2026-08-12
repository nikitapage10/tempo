"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type WorkPanelTabId =
  | "work"
  | "files"
  | "notes"
  | "references"
  | "details"
  | "comments"
  | "people"
  | "activity";

type TabDef = {
  id: WorkPanelTabId;
  label: string;
  content: React.ReactNode;
  badge?: number;
};

type TrackWorkPanelProps = {
  work: React.ReactNode;
  files: React.ReactNode;
  notes: React.ReactNode;
  details: React.ReactNode;
  /** Optional Comments tab slot — omit until a caller wires comments (V2 §8). */
  comments?: React.ReactNode;
  commentsCount?: number;
  /** Optional References tab slot (FEATURE-SPECS §11). */
  references?: React.ReactNode;
  /** Optional People tab slot — owner + collaborators (FEATURE-SPECS §13). */
  people?: React.ReactNode;
  peopleCount?: number;
  /** Optional Activity tab slot (FEATURE-SPECS §13). */
  activity?: React.ReactNode;
  /** Tab to open when `?panel=` isn't set — from workspace preferences (FEATURE-SPECS §15). */
  defaultTab?: WorkPanelTabId;
  className?: string;
};

/**
 * Sticky (desktop) work panel with a tablist for Work/Files/Notes/Details
 * (+ Comments when wired). Syncs the active tab to `?panel=` and keeps every
 * panel mounted (hidden, not unmounted) so component state survives tab
 * switches (V2 §8).
 */
export function TrackWorkPanel({
  work,
  files,
  notes,
  details,
  comments,
  commentsCount,
  references,
  people,
  peopleCount,
  activity,
  defaultTab = "work",
  className,
}: TrackWorkPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const btnRefs = React.useRef<Partial<Record<WorkPanelTabId, HTMLButtonElement | null>>>({});

  const tabs: TabDef[] = React.useMemo(() => {
    const base: TabDef[] = [
      { id: "work", label: "Work", content: work },
      { id: "files", label: "Files", content: files },
      { id: "notes", label: "Notes", content: notes },
      { id: "details", label: "Details", content: details },
    ];
    if (references) {
      base.splice(3, 0, { id: "references", label: "References", content: references });
    }
    if (comments) {
      base.splice(3, 0, {
        id: "comments",
        label: "Comments",
        content: comments,
        badge: commentsCount,
      });
    }
    if (people) {
      base.push({ id: "people", label: "People", content: people, badge: peopleCount });
    }
    if (activity) {
      base.push({ id: "activity", label: "Activity", content: activity });
    }
    return base;
  }, [
    work,
    files,
    notes,
    details,
    comments,
    commentsCount,
    references,
    people,
    peopleCount,
    activity,
  ]);

  const requested = searchParams.get("panel");
  const active: WorkPanelTabId = tabs.some((t) => t.id === requested)
    ? (requested as WorkPanelTabId)
    : tabs.some((t) => t.id === defaultTab)
      ? defaultTab
      : "work";

  function selectTab(id: WorkPanelTabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === defaultTab || (id === "work" && defaultTab === "work")) {
      if (id === "work") params.delete("panel");
      else params.set("panel", id);
    } else {
      params.set("panel", id);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (e.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") nextIndex = 0;
    if (e.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex != null) {
      e.preventDefault();
      const id = tabs[nextIndex].id;
      selectTab(id);
      btnRefs.current[id]?.focus();
    }
  }

  return (
    <div className={cn("lg:sticky lg:top-4", className)}>
      <div
        role="tablist"
        aria-label="Track tools"
        // Wraps rather than scrolls — with 8 tools, horizontal scroll hid
        // Details/People/Activity entirely until you dragged the bar.
        className="flex flex-wrap gap-1 rounded-input border border-line bg-bg-2/60 p-1"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              btnRefs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={`panel-tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`panel-tabpanel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-input px-3 py-1.5 text-xs font-medium transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
              active === tab.id
                ? "bg-bg-1 text-ice shadow-e1"
                : "text-text-lo hover:bg-bg-1/50 hover:text-text-hi"
            )}
          >
            {tab.label}
            {tab.badge ? (
              <span className="rounded-chip bg-amber/15 px-1.5 py-0.5 font-mono text-[11px] text-amber">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-4">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`panel-tabpanel-${tab.id}`}
            aria-labelledby={`panel-tab-${tab.id}`}
            hidden={active !== tab.id}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
