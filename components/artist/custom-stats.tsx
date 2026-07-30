"use client";

import * as React from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SectionHeader, QuietEmpty } from "@/components/ui/section-header";
import { TrendLine } from "@/components/artist/platform-modules";
import { useCustomModuleMutations } from "@/hooks/use-custom-stats";
import type { CustomStat, CustomStatModule } from "@/lib/api/custom-stats";
import { cn } from "@/lib/utils";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatValue(value: number, unit: string | null): string {
  const n = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return unit ? `${n} ${unit}` : n;
}

/** Most recent readings, newest first — enough to spot and undo a typo. */
function RecentEntries({
  entries,
  unit,
  onUndo,
}: {
  entries: CustomStat["entries"];
  unit: string | null;
  onUndo: (entryId: string) => void;
}) {
  const recent = [...entries].reverse().slice(0, 5);
  if (recent.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1">
      {recent.map((e) => (
        <li
          key={e.id}
          className="flex items-center justify-between gap-2 text-[11px] text-text-lo"
        >
          <span className="tabular-nums">{e.recorded_on}</span>
          <span className="flex items-center gap-1.5">
            <span className="tabular-nums text-text-hi">
              {formatValue(e.value, unit)}
            </span>
            <button
              type="button"
              onClick={() => onUndo(e.id)}
              className="rounded-input p-0.5 text-text-lo transition-colors duration-hover hover:bg-warn/15 hover:text-warn"
              aria-label={`Undo ${formatValue(e.value, unit)} logged ${e.recorded_on}`}
              title="Undo this entry"
            >
              <X className="size-3" />
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatRow({
  stat,
  onLog,
  onDelete,
  onUndoEntry,
}: {
  stat: CustomStat;
  onLog: (value: number, recordedOn: string) => Promise<unknown>;
  onDelete: () => void;
  onUndoEntry: (entryId: string) => void;
}) {
  const [value, setValue] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();

  const latest = stat.entries.length
    ? stat.entries[stat.entries.length - 1]
    : null;
  const points = stat.entries.map((e) => ({
    date: e.recorded_on,
    value: e.value,
  }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(value);
    if (!Number.isFinite(n) || !date) return;
    setBusy(true);
    try {
      await onLog(n, date);
      setValue("");
      setDate(today());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t log that value.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="well rounded-input p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-text-hi">{stat.label}</p>
        <div className="flex shrink-0 items-center gap-2">
          <p className="text-sm tabular-nums text-text-hi">
            {latest ? formatValue(latest.value, stat.unit) : "—"}
          </p>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:bg-warn/15 hover:text-warn"
            aria-label={`Remove ${stat.label}`}
          >
            <X className="size-3" />
          </button>
        </div>
      </div>

      <div className="mt-2">
        <TrendLine points={points} label={stat.label} />
      </div>

      <RecentEntries
        entries={stat.entries}
        unit={stat.unit}
        onUndo={onUndoEntry}
      />

      <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
          className="h-7 w-32 rounded-input border border-line bg-bg-2 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        />
        <input
          type="number"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value…"
          className="h-7 w-24 rounded-input border border-line bg-bg-2 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          disabled={busy || !value.trim()}
          className="h-7 px-2 text-xs"
        >
          {busy ? "Saving…" : "Log"}
        </Button>
      </form>
    </div>
  );
}

function AddStatForm({ onAdd }: { onAdd: (label: string, unit: string | null) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    try {
      await onAdd(label.trim(), unit.trim() || null);
      setLabel("");
      setUnit("");
      setOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t add that stat.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-1 rounded-chip border border-dashed border-line px-2.5 py-1 text-xs text-ice transition-colors duration-hover hover:border-ice/50 hover:bg-ice/10"
      >
        <Plus className="size-3" />
        Add a stat to track
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-1.5">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        maxLength={60}
        placeholder="Name, e.g. Sync placements"
        className="h-7 min-w-0 flex-1 rounded-input border border-line bg-bg-2 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      />
      <input
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        maxLength={16}
        placeholder="Unit (optional)"
        className="h-7 w-32 rounded-input border border-line bg-bg-2 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      />
      <Button type="submit" size="sm" disabled={busy || !label.trim()}>
        {busy ? "Adding…" : "Add"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}

/** One hand-built module — a titled card holding any number of tracked stats. */
export function CustomModuleCard({
  artistId,
  module: mod,
  quiet,
  onDeleted,
}: {
  artistId: string;
  module: CustomStatModule;
  quiet?: boolean;
  onDeleted?: (moduleId: string) => void;
}) {
  const { renameModule, removeModule, addStat, removeStat, logValue, removeEntry } =
    useCustomModuleMutations(artistId);
  const { toast } = useToast();
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [title, setTitle] = React.useState(mod.title);

  React.useEffect(() => setTitle(mod.title), [mod.title]);

  async function commitTitle() {
    setEditingTitle(false);
    const trimmed = title.trim();
    if (!trimmed || trimmed === mod.title) {
      setTitle(mod.title);
      return;
    }
    try {
      await renameModule.mutateAsync({ moduleId: mod.id, title: trimmed });
    } catch (err) {
      setTitle(mod.title);
      toast(err instanceof Error ? err.message : "Couldn’t rename that module.");
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remove “${mod.title}” and everything logged in it?`)) {
      return;
    }
    try {
      await removeModule.mutateAsync(mod.id);
      onDeleted?.(mod.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t remove that module.");
    }
  }

  return (
    <section className={cn(quiet ? "panel-quiet" : "panel", "p-5")}>
      <SectionHeader
        label={editingTitle ? "" : mod.title}
        aside={
          <div className="flex items-center gap-1">
            {editingTitle ? (
              <span className="flex items-center gap-1">
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitTitle();
                    }
                    if (e.key === "Escape") {
                      setTitle(mod.title);
                      setEditingTitle(false);
                    }
                  }}
                  maxLength={60}
                  className="h-7 w-40 rounded-input border border-line bg-bg-2 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                />
                <button
                  type="button"
                  onClick={() => void commitTitle()}
                  className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:text-ice"
                  aria-label="Save title"
                >
                  <Check className="size-3.5" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:text-ice"
                aria-label={`Rename ${mod.title}`}
              >
                <Pencil className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:bg-warn/15 hover:text-warn"
              aria-label={`Remove ${mod.title} module`}
            >
              <X className="size-3.5" />
            </button>
          </div>
        }
      />

      {mod.stats.length === 0 ? (
        <QuietEmpty>
          Nothing tracked here yet — add whatever number you want to keep an
          eye on.
        </QuietEmpty>
      ) : (
        <div className="space-y-2.5">
          {mod.stats.map((s) => (
            <StatRow
              key={s.id}
              stat={s}
              onLog={(value, recordedOn) =>
                logValue.mutateAsync({ statId: s.id, value, recordedOn })
              }
              onDelete={() => removeStat.mutate(s.id)}
              onUndoEntry={(entryId) => removeEntry.mutate(entryId)}
            />
          ))}
        </div>
      )}

      <AddStatForm
        onAdd={(label, unit) =>
          addStat.mutateAsync({
            moduleId: mod.id,
            label,
            unit,
            sortOrder: mod.stats.length,
          })
        }
      />
    </section>
  );
}
