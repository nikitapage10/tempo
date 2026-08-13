"use client";

import * as React from "react";
import { LayoutGrid, Check, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LayoutTemplate, WorkspacePreset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SlitDivider } from "@/components/ui/slit";

const PRESET_OPTIONS: { value: WorkspacePreset; label: string }[] = [
  { value: "writing", label: "Writing" },
  { value: "production", label: "Production" },
  { value: "feedback", label: "Feedback" },
  { value: "mix_review", label: "Mix review" },
  { value: "release_prep", label: "Release prep" },
  { value: "custom", label: "Custom" },
];

type Props = {
  editing: boolean;
  preset: WorkspacePreset;
  saving?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onReset: () => void;
  onApplyPreset: (preset: WorkspacePreset) => void;
  /** Saved templates — user's own named arrangements. */
  templates?: LayoutTemplate[];
  onApplyTemplate?: (t: LayoutTemplate) => void;
  onSaveTemplate?: (name: string) => Promise<void> | void;
  onDeleteTemplate?: (t: LayoutTemplate) => Promise<void> | void;
};

export function LayoutToolbar({
  editing,
  preset,
  saving,
  onEdit,
  onCancel,
  onSave,
  onReset,
  onApplyPreset,
  templates = [],
  onApplyTemplate,
  onSaveTemplate,
  onDeleteTemplate,
}: Props) {
  const [naming, setNaming] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function commitSaveTemplate() {
    if (!onSaveTemplate || !name.trim()) return;
    setBusy(true);
    try {
      await onSaveTemplate(name.trim());
      setName("");
      setNaming(false);
    } finally {
      setBusy(false);
    }
  }
  if (!editing) {
    // Nothing to show when not editing — the Edit menu lives in the track
    // header now, so this no longer costs a row of blank space above the modules.
    return null;
  }

  return (
    <div className="panel glow-ice p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-hi">Editing layout</p>
          <p className="mt-0.5 text-xs text-text-lo">
            Drag modules between columns, or hide what you don’t need.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={onReset}
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={onCancel}
          >
            <X className="size-3.5" />
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={saving}
            onClick={onSave}
          >
            <Check className="size-3.5" />
            {saving ? "Saving…" : "Done"}
          </Button>
        </div>
      </div>

      <SlitDivider className="mt-4" />
      <div className="pt-3">
        <p className="label-mono mb-2">Start from a preset</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_OPTIONS.filter((o) => o.value !== "custom" || preset === "custom").map(
            (o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onApplyPreset(o.value)}
                disabled={o.value === "custom"}
                className={cn(
                  "rounded-chip border px-2.5 py-1 text-xs transition-colors duration-hover",
                  preset === o.value
                    ? "border-ice text-ice"
                    : "border-line text-text-lo hover:text-text-hi",
                  o.value === "custom" && "cursor-default opacity-70"
                )}
                title={
                  o.value === "custom"
                    ? "Your own arrangement"
                    : `Apply the ${o.label} layout`
                }
              >
                {o.label}
              </button>
            )
          )}
        </div>
        <p className="mt-2 text-xs text-text-lo">
          Each preset shows a focused set and groups the rest into tabs.
          Anything left out stays in “Hidden” below. Drop one module onto
          another to combine them into tabs. This layout is yours only —
          collaborators keep their own.
        </p>
      </div>

      {onSaveTemplate ? (
        <>
          <SlitDivider className="mt-3" />
          <div className="pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="label-mono">Your templates</p>
            {templates.length === 0 && !naming ? (
              <span className="text-xs text-text-lo/70">
                None saved yet
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {templates.map((t) => (
              <span
                key={t.id}
                className="flex items-center overflow-hidden rounded-chip border border-line"
              >
                <button
                  type="button"
                  onClick={() => onApplyTemplate?.(t)}
                  className="max-w-[180px] truncate px-2.5 py-1 text-xs text-text-lo transition-colors duration-hover hover:bg-bg-2 hover:text-text-hi"
                  title={`Apply “${t.name}”`}
                >
                  {t.name}
                </button>
                {onDeleteTemplate ? (
                  <button
                    type="button"
                    onClick={() => void onDeleteTemplate(t)}
                    className="border-l border-line px-1.5 py-1 text-text-lo transition-colors duration-hover hover:bg-warn/15 hover:text-warn"
                    aria-label={`Delete template ${t.name}`}
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </span>
            ))}

            {naming ? (
              <span className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitSaveTemplate();
                    }
                    if (e.key === "Escape") {
                      setNaming(false);
                      setName("");
                    }
                  }}
                  maxLength={60}
                  placeholder="Template name…"
                  className="h-7 w-44 rounded-input border border-line bg-bg-2 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!name.trim() || busy}
                  onClick={() => void commitSaveTemplate()}
                >
                  {busy ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNaming(false);
                    setName("");
                  }}
                >
                  Cancel
                </Button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setNaming(true)}
                className="flex items-center gap-1 rounded-chip border border-dashed border-line px-2.5 py-1 text-xs text-ice transition-colors duration-hover hover:border-ice/50 hover:bg-ice/10"
              >
                <Save className="size-3" />
                Save current as template
              </button>
            )}
          </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
