"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function ProjectsPage() {
  const router = useRouter();
  const { data: projects = [], isLoading } = useProjects();
  const { create } = useProjectMutations();
  const { activeSpaceId } = useActiveSpace();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
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
      });
      setOpen(false);
      setName("");
      setDescription("");
      setDeadline("");
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-text-hi">
            Projects
          </h1>
          <p className="mt-1 text-sm text-text-lo">
            Containers for EPs, edit packs, and campaigns.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          New project
        </Button>
      </div>

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
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="overflow-hidden rounded-card border border-line transition-colors duration-hover hover:border-ice/40"
            >
              <div className="bg-bg-1 p-4 pb-3">
                <h2 className="font-display text-base font-semibold text-text-hi">
                  {p.name}
                </h2>
                {p.deadline ? (
                  <p className="mt-1 font-mono text-[11px] text-text-lo">
                    Due {formatShortDate(p.deadline + "T12:00:00")}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-3 font-mono text-[11px] text-text-lo">
                  <span>{p.track_count} tracks</span>
                  <span>{p.task_count} tasks</span>
                  <span>
                    {p.checklist_pct == null
                      ? "— checklist"
                      : `${p.checklist_pct}% checklist`}
                  </span>
                </div>
              </div>
              {p.checklist_pct != null ? (
                <div className="px-4 pb-4">
                  <FlareLine variant="partial" pct={p.checklist_pct} />
                </div>
              ) : null}
            </Link>
          ))}
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
