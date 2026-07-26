"use client";

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStageMutations, useStages } from "@/hooks/use-stages";
import type { Stage } from "@/lib/types";
import { cn } from "@/lib/utils";

type StageEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  spaceName: string;
};

export function StageEditor({
  open,
  onOpenChange,
  spaceId,
  spaceName,
}: StageEditorProps) {
  const { data: stages = [], isLoading } = useStages(spaceId);
  const { create, rename, remove, reorder, countTracksInStage } =
    useStageMutations(spaceId);

  const [newName, setNewName] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<Stage | null>(null);
  const [trackCount, setTrackCount] = React.useState(0);
  const [moveTo, setMoveTo] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await create.mutateAsync({
        name: newName.trim(),
        sort: stages.length,
      });
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add stage.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string, name: string) {
    if (!name.trim()) return;
    try {
      await rename.mutateAsync({ id, name: name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename stage.");
    }
  }

  async function beginDelete(stage: Stage) {
    setError(null);
    try {
      const count = await countTracksInStage(stage.id);
      setTrackCount(count);
      setDeleteTarget(stage);
      const other = stages.find((s) => s.id !== stage.id);
      setMoveTo(other?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check tracks.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (trackCount > 0 && !moveTo) {
      setError("Pick a stage to move those tracks into.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await remove.mutateAsync({
        stageId: deleteTarget.id,
        moveTo: trackCount > 0 ? moveTo : null,
      });
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete stage.");
    } finally {
      setBusy(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(stages, oldIndex, newIndex).map((s, i) => ({
      id: s.id,
      sort: i,
    }));
    reorder.mutate(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Stage editor"
        description={`Workflow for ${spaceName}. Drag to reorder.`}
        onClose={() => onOpenChange(false)}
      >
        {isLoading ? (
          <p className="text-sm text-text-lo">Loading stages…</p>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={stages.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-2">
                  {stages.map((stage) => (
                    <SortableStageRow
                      key={stage.id}
                      stage={stage}
                      onRename={handleRename}
                      onDelete={() => beginDelete(stage)}
                      canDelete={stages.length > 1}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>

            <form onSubmit={handleAdd} className="mt-4 flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New stage name"
              />
              <Button type="submit" disabled={busy || !newName.trim()}>
                <Plus className="size-3.5" />
                Add
              </Button>
            </form>
          </>
        )}

        {deleteTarget ? (
          <div className="mt-4 rounded-card border border-warn/30 bg-warn/5 p-4">
            <p className="text-sm text-text-hi">
              Delete <span className="font-medium">{deleteTarget.name}</span>?
            </p>
            {trackCount > 0 ? (
              <div className="mt-3">
                <Label htmlFor="move-to">
                  {trackCount} track{trackCount === 1 ? "" : "s"} live here —
                  move them to
                </Label>
                <select
                  id="move-to"
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                >
                  {stages
                    .filter((s) => s.id !== deleteTarget.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <p className="mt-2 text-sm text-text-lo">
                No tracks in this stage — safe to remove.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={confirmDelete}
              >
                Delete stage
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-warn">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

function SortableStageRow({
  stage,
  onRename,
  onDelete,
  canDelete,
}: {
  stage: Stage;
  onRename: (id: string, name: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });
  const [name, setName] = React.useState(stage.name);

  React.useEffect(() => {
    setName(stage.name);
  }, [stage.name]);

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-2 rounded-input border border-line bg-bg-2 px-2 py-1.5",
        isDragging && "ring-1 ring-ice/50 opacity-90"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none p-1 text-text-lo active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name.trim() !== stage.name) {
            onRename(stage.id, name);
          } else {
            setName(stage.name);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-8 border-transparent bg-transparent px-1 focus-visible:border-line focus-visible:bg-bg-0"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 text-text-lo hover:text-warn"
        disabled={!canDelete}
        onClick={onDelete}
        aria-label={`Delete ${stage.name}`}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}
