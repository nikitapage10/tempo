"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { HeaderMenu } from "@/components/ui/header-menu";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { SOURCE_FILTERS, type CalendarPreset } from "@/components/calendar/use-calendar-view-state";
import type { CalendarSourceGroup } from "@/lib/calendar/types";

function PresetRow({ preset, onApply, onRename, onDelete }: { preset: CalendarPreset; onApply: () => void; onRename: (name: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(preset.name);
  if (editing) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          onRename(name);
          setEditing(false);
        }}
      >
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            onRename(name);
            setEditing(false);
          }}
          className="h-7 min-w-0 flex-1 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi"
        />
      </form>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onApply} className="min-w-0 flex-1 truncate rounded-input px-2 py-1 text-left text-xs text-text-hi hover:bg-bg-2">
        {preset.name}
      </button>
      <button type="button" onClick={() => setEditing(true)} aria-label={`Rename ${preset.name}`} className="rounded-input p-1 text-text-lo hover:bg-bg-2 hover:text-ice">
        <Pencil className="size-3" />
      </button>
      <button type="button" onClick={onDelete} aria-label={`Delete ${preset.name}`} className="rounded-input p-1 text-text-lo hover:bg-bg-2 hover:text-warn">
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

export function CalendarFiltersPopover({
  sourceFilters,
  onToggleSource,
  showCompleted,
  onToggleCompleted,
  presets,
  onSavePreset,
  onApplyPreset,
  onRenamePreset,
  onDeletePreset,
}: {
  sourceFilters: Set<CalendarSourceGroup>;
  onToggleSource: (source: CalendarSourceGroup) => void;
  showCompleted: boolean;
  onToggleCompleted: () => void;
  presets: CalendarPreset[];
  onSavePreset: (name?: string) => void;
  onApplyPreset: (preset: CalendarPreset) => void;
  onRenamePreset: (id: string, name: string) => void;
  onDeletePreset: (id: string) => void;
}) {
  const [presetName, setPresetName] = React.useState("");
  const activeSourceCount = sourceFilters.size;
  const active = activeSourceCount < SOURCE_FILTERS.length || showCompleted;
  const summary = activeSourceCount < SOURCE_FILTERS.length ? `${activeSourceCount}/${SOURCE_FILTERS.length} sources` : showCompleted ? "Completed shown" : null;

  return (
    <HeaderMenu
      label="Filters"
      active={active}
      summary={summary}
      panelWidth={280}
      onClear={
        active
          ? () => {
              SOURCE_FILTERS.forEach((filter) => {
                if (!sourceFilters.has(filter.value)) onToggleSource(filter.value);
              });
              if (showCompleted) onToggleCompleted();
            }
          : undefined
      }
    >
      <div>
        <span className="label-mono text-[11px] text-text-lo/70">Sources</span>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {SOURCE_FILTERS.map((filter) => (
            <Chip key={filter.value} size="sm" active={sourceFilters.has(filter.value)} onClick={() => onToggleSource(filter.value)}>
              {filter.label}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <Chip size="sm" active={showCompleted} onClick={onToggleCompleted}>
          Completed
        </Chip>
      </div>
      <div className="border-t border-line/60 pt-2">
        <span className="label-mono text-[11px] text-text-lo/70">Saved views</span>
        <div className="mt-1.5 space-y-0.5">
          {presets.length ? (
            presets.map((preset) => (
              <PresetRow
                key={preset.id}
                preset={preset}
                onApply={() => onApplyPreset(preset)}
                onRename={(name) => onRenamePreset(preset.id, name)}
                onDelete={() => onDeletePreset(preset.id)}
              />
            ))
          ) : (
            <p className="px-2 text-xs text-text-lo">No saved views yet.</p>
          )}
        </div>
        <form
          className="mt-2 flex gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            onSavePreset(presetName);
            setPresetName("");
          }}
        >
          <input
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder="Name this view…"
            className="h-7 min-w-0 flex-1 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi placeholder:text-text-lo"
          />
          <Button type="submit" size="sm" variant="ghost">
            Save
          </Button>
        </form>
      </div>
    </HeaderMenu>
  );
}
