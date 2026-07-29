"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { FlareLine } from "@/components/flare-line";
import { useActiveSpace } from "@/components/active-space-provider";
import { useProjectMutations, useProjects } from "@/hooks/use-projects";
import { formatShortDate } from "@/lib/format";
import { PROJECT_TYPES } from "@/lib/constants";
import type { ProjectType } from "@/lib/types";
import { cn } from "@/lib/utils";

function ProjectStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p
        className={cn(
          "font-mono text-xl tabular-nums leading-none",
          value > 0 ? "text-text-hi" : "text-text-lo/50"
        )}
      >
        {value}
      </p>
      <p className="label-mono mt-1.5">{label}</p>
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const { activeSpaceId } = useActiveSpace();
  const { data: projects = [], isLoading } = useProjects(activeSpaceId);
  const { create } = useProjectMutations();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [projectType, setProjectType] = React.useState<ProjectType>("general");
  const [busy, setBusy] = React.useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const p = await create.mutateAsync({
        name,
        description,
        deadline: deadline || null,
        space_id: activeSpaceId,
        project_type: projectType,
      });
      setOpen(false);
      setName("");
      setDescription("");
      setDeadline("");
      setProjectType("general");
      toast("Project created", "ok");
      router.push(`/projects/${p.id}`);
    } catch (err) {
      toast(
        err instanceof Error
          ? err.message
          : "Couldn’t create project — try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects"
        subtitle="Containers for EPs, edit packs, and campaigns."
        actions={
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New project
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-32 animate-pulse rounded-card bg-bg-1" />
          <div className="h-32 animate-pulse rounded-card bg-bg-1" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyShaderPanel
          title="No projects yet"
          copy="Start something like an EP or edit pack."
          action={
            <Button type="button" onClick={() => setOpen(true)}>
              Create a project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <SpotlightCard
              key={p.id}
              tone={p.project_type === "general" ? "ice" : "amber"}
              className="min-h-[188px]"
            >
              <Link
                href={`/projects/${p.id}`}
                className="panel lift flex h-full min-h-[188px] flex-col overflow-hidden"
              >
              <div className="relative flex flex-1 flex-col p-5">
                <div className="flex items-start gap-1.5">
                  <h2 className="min-w-0 flex-1 font-display text-base font-semibold text-text-hi">
                    {p.name}
                  </h2>
                  {p.project_type !== "general" ? (
                    <span className="shrink-0 rounded-chip border border-amber/30 bg-amber/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-amber">
                      {PROJECT_TYPES.find((t) => t.value === p.project_type)
                        ?.label ?? p.project_type}
                    </span>
                  ) : null}
                </div>
                {p.deadline ? (
                  <p className="mt-1 font-mono text-[11px] text-text-lo">
                    Due {formatShortDate(p.deadline + "T12:00:00")}
                  </p>
                ) : null}

                {/* Counts as figures rather than a run-on line — the card has
                    room, and a number you can read at a glance is worth more. */}
                <div className="mt-4 flex gap-6">
                  <ProjectStat value={p.track_count} label="Tracks" />
                  <ProjectStat value={p.task_count} label="Tasks" />
                </div>

                <div className="mt-auto pt-4">
                  {p.checklist_pct != null ? (
                    <>
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="label-mono">Checklist</span>
                        <span className="font-mono text-[11px] tabular-nums text-text-hi">
                          {p.checklist_pct}%
                        </span>
                      </div>
                      <FlareLine variant="partial" pct={p.checklist_pct} />
                    </>
                  ) : (
                    <p className="text-[11px] text-text-lo/70">
                      {p.track_count === 0
                        ? "No tracks attached yet"
                        : "No checklist items yet"}
                    </p>
                  )}
                </div>
              </div>
              </Link>
            </SpotlightCard>
          ))}

          {/* Ghost tile — keeps a sparse grid looking composed and puts the
              next action where the eye already is. */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="lift flex min-h-[188px] flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-line text-text-lo hover:text-ice"
          >
            <Plus className="size-5" />
            <span className="text-sm">New project</span>
            <span className="max-w-[22ch] text-center text-[11px] text-text-lo/70">
              An EP, an edit pack, a campaign
            </span>
          </button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="New project"
          description="Name it after the pack, EP, or campaign."
          onClose={() => setOpen(false)}
        >
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label htmlFor="proj-name">Name</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                required
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="proj-type">Type</Label>
              <select
                id="proj-type"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as ProjectType)}
                className="mt-1 flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {projectType !== "general" ? (
                <p className="mt-1 text-[11px] text-text-lo">
                  Adds a release workspace — date, readiness, track order, metadata, pitching.
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea
                id="proj-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="proj-deadline">Deadline</Label>
              <Input
                id="proj-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
