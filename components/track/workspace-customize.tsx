"use client";

import * as React from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  useExactPreference,
  useResolvedPreference,
  useWorkspacePrefMutations,
} from "@/hooks/use-workspace-prefs";
import {
  ALL_MODULE_IDS,
  ALWAYS_VISIBLE_WITH_VERSIONS,
  DEFAULT_PANEL_OPTIONS,
  MODULE_DEFS,
  PRESET_DEFAULTS,
  effectivePresetShape,
  type ModuleId,
} from "@/lib/workspace-presets";
import type { WorkspacePreset } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRESET_OPTIONS: { value: WorkspacePreset; label: string }[] = [
  { value: "writing", label: "Writing" },
  { value: "production", label: "Production" },
  { value: "feedback", label: "Feedback" },
  { value: "mix_review", label: "Mix review" },
  { value: "release_prep", label: "Release prep" },
  { value: "custom", label: "Custom" },
];

type Props = {
  trackId: string;
  stageId: string | null;
  hasVersions: boolean;
};

export function WorkspaceCustomizeButton(props: Props) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-text-lo"
        onClick={() => setOpen(true)}
      >
        <Settings2 className="size-3.5" />
        Customize
      </Button>
      <WorkspaceCustomizeDialog
        open={open}
        onOpenChange={setOpen}
        {...props}
      />
    </>
  );
}

function WorkspaceCustomizeDialog({
  open,
  onOpenChange,
  trackId,
  stageId,
  hasVersions,
}: Props & { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const resolved = useResolvedPreference({ trackId, stageId });
  const exact = useExactPreference({ trackId });
  const { save, remove } = useWorkspacePrefMutations();

  const shape = effectivePresetShape(resolved.data ?? null);
  const [preset, setPreset] = React.useState<WorkspacePreset>("production");
  const [moduleOrder, setModuleOrder] = React.useState<ModuleId[]>(shape.moduleOrder);
  const [hidden, setHidden] = React.useState<ModuleId[]>(shape.hiddenModules);
  const [defaultPanel, setDefaultPanel] = React.useState(shape.defaultPanel);
  const [compactMode, setCompactMode] = React.useState(shape.compactMode);

  React.useEffect(() => {
    if (!open) return;
    const s = effectivePresetShape(resolved.data ?? null);
    setPreset(resolved.data?.preset ?? "production");
    setModuleOrder(s.moduleOrder);
    setHidden(s.hiddenModules);
    setDefaultPanel(s.defaultPanel);
    setCompactMode(s.compactMode);
  }, [open, resolved.data]);

  function applyPreset(p: WorkspacePreset) {
    setPreset(p);
    const d = PRESET_DEFAULTS[p];
    setModuleOrder(d.moduleOrder);
    setHidden(d.hiddenModules);
    setDefaultPanel(d.defaultPanel);
    setCompactMode(d.compactMode);
  }

  function move(id: ModuleId, dir: -1 | 1) {
    setModuleOrder((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setPreset("custom");
  }

  function toggleHidden(id: ModuleId) {
    if (hasVersions && id === ALWAYS_VISIBLE_WITH_VERSIONS) return;
    setHidden((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setPreset("custom");
  }

  async function onSave() {
    try {
      await save.mutateAsync({
        trackId,
        preset,
        moduleOrder,
        hiddenModules: hidden,
        defaultPanel,
        compactMode,
      });
      toast("Workspace saved", "ok");
      onOpenChange(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t save layout.");
    }
  }

  async function onResetTrack() {
    if (!exact.data) {
      applyPreset("production");
      return;
    }
    try {
      await remove.mutateAsync(exact.data.id);
      toast("Track layout reset", "ok");
      onOpenChange(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t reset.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Customize workspace"
        description="Presets change order and the default panel. Waveform stays visible when you have a bounce."
        onClose={() => onOpenChange(false)}
      >
        <div className="space-y-4">
          <div>
            <Label>Preset</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESET_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => applyPreset(o.value)}
                  className={cn(
                    "rounded-chip border px-2.5 py-1 text-xs",
                    preset === o.value
                      ? "border-ice text-ice"
                      : "border-line text-text-lo hover:text-text-hi"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Module order</Label>
            <ul className="mt-2 space-y-1">
              {moduleOrder.map((id) => {
                const def = MODULE_DEFS.find((m) => m.id === id)!;
                const locked =
                  hasVersions && id === ALWAYS_VISIBLE_WITH_VERSIONS;
                const isHidden = hidden.includes(id) && !locked;
                return (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-input border border-line bg-bg-2 px-2 py-1.5"
                  >
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-xs",
                        isHidden && "text-text-lo line-through"
                      )}
                    >
                      {def.label}
                    </span>
                    <button
                      type="button"
                      className="text-[11px] text-ice"
                      onClick={() => move(id, -1)}
                      aria-label={`Move ${def.label} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-ice"
                      onClick={() => move(id, 1)}
                      aria-label={`Move ${def.label} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={locked}
                      className="text-[11px] text-text-lo disabled:opacity-40"
                      onClick={() => toggleHidden(id)}
                    >
                      {locked ? "Required" : isHidden ? "Show" : "Hide"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="default-panel">Default panel tab</Label>
              <select
                id="default-panel"
                value={defaultPanel}
                onChange={(e) => {
                  setDefaultPanel(e.target.value as typeof defaultPanel);
                  setPreset("custom");
                }}
                className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm"
              >
                {DEFAULT_PANEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm text-text-lo">
              <input
                type="checkbox"
                checked={compactMode}
                onChange={(e) => {
                  setCompactMode(e.target.checked);
                  setPreset("custom");
                }}
              />
              Compact mode
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => void onResetTrack()}>
              Reset track
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={save.isPending} onClick={() => void onSave()}>
              Save
            </Button>
          </div>
          <p className="text-[11px] text-text-lo">
            Unused modules stay in {ALL_MODULE_IDS.length} slots. Layout is yours only — collaborators keep their own.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
