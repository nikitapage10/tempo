"use client";

import * as React from "react";
import { moduleLabel, type ModuleId } from "@/lib/workspace-presets";
import { cn } from "@/lib/utils";

/**
 * Renders a slot holding more than one module as a tabbed group — the result
 * of dropping one module onto another in the layout editor.
 *
 * Tab state is local and ephemeral: which tab is open is a moment-to-moment
 * choice, not part of the saved layout.
 */
export function ModuleTabs({
  members,
  modules,
  badges,
}: {
  members: ModuleId[];
  modules: Partial<Record<ModuleId, React.ReactNode>>;
  badges?: Partial<Record<ModuleId, number>>;
}) {
  const present = members.filter((id) => modules[id]);
  const [active, setActive] = React.useState<ModuleId | undefined>(present[0]);

  // If the active tab disappears (module hidden or regrouped), fall back.
  React.useEffect(() => {
    if (!active || !present.includes(active)) setActive(present[0]);
  }, [present, active]);

  if (present.length === 0) return null;
  if (present.length === 1) return <>{modules[present[0]]}</>;

  return (
    <section className="panel overflow-hidden">
      <div
        role="tablist"
        aria-label="Grouped tools"
        className="flex flex-wrap gap-1 border-b border-line/70 bg-bg-0/40 p-1.5"
      >
        {present.map((id) => {
          const selected = id === active;
          const badge = badges?.[id];
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`grouped-panel-${id}`}
              id={`grouped-tab-${id}`}
              onClick={() => setActive(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-input px-2.5 py-1.5 text-xs font-medium transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                selected
                  ? "bg-bg-2 text-ice shadow-e1"
                  : "text-text-lo hover:bg-bg-2/50 hover:text-text-hi"
              )}
            >
              {shortLabel(id)}
              {badge ? (
                <span className="rounded-chip bg-amber/15 px-1.5 py-0.5 font-mono text-[10px] text-amber">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {present.map((id) => (
        <div
          key={id}
          role="tabpanel"
          id={`grouped-panel-${id}`}
          aria-labelledby={`grouped-tab-${id}`}
          hidden={id !== active}
          // Grouped children bring their own panel chrome; strip the duplicate
          // border/shadow so the group reads as one surface, not nested cards.
          className="[&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none [&>*]:before:hidden"
        >
          {modules[id]}
        </div>
      ))}
    </section>
  );
}

/** Tab bars are tight; drop the parenthetical half of long module names. */
function shortLabel(id: ModuleId): string {
  return moduleLabel(id).replace(/\s*\(.*\)$/, "").replace(/^Player & waveform$/, "Player");
}
