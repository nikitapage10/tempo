"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckSquare2, Eye, LayoutList, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  installStarterKits,
  previewStarterKits,
  type StarterKitPreview,
} from "@/lib/api/team-operations";
import { cn, errorMessage } from "@/lib/utils";

const KITS = [
  { key: "manager", label: "Manager", description: "Priorities, decisions, releases, and artist handoffs." },
  { key: "label", label: "Label / label owner", description: "Release gates, delivery, DSP pitches, and first-week learning." },
  { key: "publicist", label: "Publicist", description: "Campaign stories, targeted outreach, follow-up, and coverage." },
  { key: "tour_manager", label: "Tour manager", description: "Advances, show days, travel control, and settlements." },
  { key: "agent", label: "Agent", description: "Offers, holds, routing decisions, and confirmed-show handoffs." },
  { key: "assistant", label: "Assistant", description: "Daily control, meetings, request triage, and weekly closeout." },
  { key: "custom", label: "Custom", description: "Flexible intake, decisions, handoffs, and a weekly operating rhythm." },
] as const;

const KIND_LABELS: Record<string, string> = {
  saved_view: "Working view",
  task_template: "Task template",
  checklist_template: "Checklist",
  project_template: "Project template",
  sample_task: "Example task",
  sample_project: "Example project",
};

function itemName(item: StarterKitPreview["items"][number]): string {
  const value = item.payload.name ?? item.payload.title ?? item.content_key;
  return typeof value === "string" ? value : item.content_key;
}

function itemDescription(item: StarterKitPreview["items"][number]): string | null {
  return typeof item.payload.description === "string" ? item.payload.description : null;
}

function itemSteps(item: StarterKitPreview["items"][number]): string[] {
  return Array.isArray(item.payload.items)
    ? item.payload.items.filter((value): value is string => typeof value === "string")
    : [];
}

export function StarterKitSetup() {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [primary, setPrimary] = React.useState("work");
  const [samples, setSamples] = React.useState(false);
  const [preview, setPreview] = React.useState<StarterKitPreview | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const previewMutation = useMutation({
    mutationFn: () => previewStarterKits(selected, primary, samples),
    onSuccess: setPreview,
    onError: (error) => toast(errorMessage(error, "Couldn’t preview those starter kits.")),
  });
  const install = useMutation({
    mutationFn: () => installStarterKits(selected, primary, samples, crypto.randomUUID()),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["pro-saved-views"] });
      toast(
        `Added ${result.added} item${result.added === 1 ? "" : "s"}${
          result.already_present ? `; ${result.already_present} already in your setup` : ""
        }.`,
        "ok"
      );
      setOpen(false);
      setPreview(null);
    },
    onError: (error) => toast(errorMessage(error, "Couldn’t install those starter kits.")),
  });

  function toggleKit(key: string) {
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
    setPreview(null);
  }

  if (!open) {
    return (
      <div className="panel-quiet flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-text-hi">Set up a real starting point</p>
          <p className="mt-1 text-xs text-text-lo">
            Each role adds 2 focused views, 4 detailed templates, and 2 optional examples.
            Everything stays private and never changes artist access.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Sparkles className="size-3.5" />
          Starter kits
        </Button>
      </div>
    );
  }

  return (
    <section className="panel space-y-5 p-4 sm:p-5">
      <div>
        <p className="label-mono text-ice">Build your operating setup</p>
        <h2 className="mt-1 font-display text-lg text-text-hi">Choose every role you actually carry</h2>
        <p className="mt-1 text-sm text-text-lo">
          Kits combine without duplicates. Preview every view, template, checklist, and example
          before adding anything; existing work is never overwritten.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {KITS.map((kit) => {
          const active = selected.includes(kit.key);
          return (
            <button
              key={kit.key}
              type="button"
              aria-pressed={active}
              onClick={() => toggleKit(kit.key)}
              className={cn(
                "rounded-input border p-3 text-left transition-colors duration-hover",
                active
                  ? "border-ice bg-ice/10"
                  : "border-line bg-bg-2/40 hover:border-ice/40 hover:bg-bg-2/70"
              )}
            >
              <span className={cn("block text-sm", active ? "text-text-hi" : "text-text-lo")}>{kit.label}</span>
              <span className="mt-1 block text-xs text-text-lo">{kit.description}</span>
              <span className="label-mono mt-2 block text-[10px] text-text-lo">6 core items · 2 examples</span>
            </button>
          );
        })}
      </div>

      <div className="panel-quiet flex flex-wrap gap-4 p-3">
        <label className="text-xs text-text-lo">
          Primary home emphasis
          <select
            value={primary}
            onChange={(event) => { setPrimary(event.target.value); setPreview(null); }}
            className="ml-2 h-8 rounded-input border border-line bg-bg-2 px-2 text-text-hi"
          >
            <option value="work">My Work</option>
            <option value="schedule">Schedule</option>
            <option value="roster">Roster</option>
            <option value="campaigns">Campaigns</option>
            <option value="touring">Touring</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-text-lo">
          <input
            type="checkbox"
            checked={samples}
            onChange={(event) => { setSamples(event.target.checked); setPreview(null); }}
            className="accent-[var(--ice)]"
          />
          Include 2 private example tasks per selected role
        </label>
      </div>

      {preview ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-text-hi">Your preview</p>
              <p className="text-xs text-text-lo">
                {preview.count} item{preview.count === 1 ? "" : "s"} from {selected.length} role
                {selected.length === 1 ? "" : "s"}
              </p>
            </div>
            <span className="label-mono text-ice">Nothing added yet</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {preview.items.map((item) => {
              const steps = itemSteps(item);
              return (
                <div key={item.content_key} className="well p-3">
                  <div className="flex items-start gap-3">
                    {item.kind === "saved_view" ? (
                      <Eye className="mt-0.5 size-4 shrink-0 text-ice" />
                    ) : item.kind.startsWith("sample_") ? (
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-amber" />
                    ) : (
                      <CheckSquare2 className="mt-0.5 size-4 shrink-0 text-ice" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-hi">{itemName(item)}</p>
                      <p className="label-mono mt-0.5 text-[10px] text-text-lo">
                        {KIND_LABELS[item.kind] ?? item.kind.replaceAll("_", " ")}
                        {steps.length ? ` · ${steps.length} steps` : ""}
                      </p>
                      {itemDescription(item) ? <p className="mt-1 text-xs text-text-lo">{itemDescription(item)}</p> : null}
                    </div>
                  </div>
                  {steps.length ? (
                    <details className="mt-2 border-t border-line/50 pt-2">
                      <summary className="cursor-pointer text-xs text-ice">See checklist</summary>
                      <ol className="mt-2 space-y-1 pl-4 text-xs text-text-lo">
                        {steps.map((step, index) => <li key={`${index}:${step}`} className="list-decimal pl-1">{step}</li>)}
                      </ol>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => { setOpen(false); setPreview(null); }}>Remind me later</Button>
        <Button
          variant="secondary"
          onClick={() => {
            setSelected([]);
            setOpen(false);
            setPreview(null);
            toast("Your Pro workspace will stay blank.", "ok");
          }}
        >
          Start blank
        </Button>
        {preview ? (
          <Button disabled={install.isPending} onClick={() => install.mutate()}>
            {install.isPending ? "Adding…" : `Add ${preview.count} items`}
          </Button>
        ) : (
          <Button
            disabled={!selected.length || previewMutation.isPending}
            onClick={() => previewMutation.mutate()}
          >
            <LayoutList className="size-3.5" />
            {previewMutation.isPending ? "Preparing…" : "Preview setup"}
          </Button>
        )}
      </div>
    </section>
  );
}
