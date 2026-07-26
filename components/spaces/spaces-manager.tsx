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
import {
  useActiveSpace,
  useSpaceMutations,
} from "@/components/active-space-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Space } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SpacesManager() {
  const { spaces, activeSpaceId, setActiveSpaceId, isLoading } =
    useActiveSpace();
  const { create, rename, remove, reorder } = useSpaceMutations();
  const [newName, setNewName] = React.useState("");
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const space = await create.mutateAsync({
        name: newName.trim(),
        sort: spaces.length,
      });
      setNewName("");
      setActiveSpaceId(space.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create space.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string, name: string) {
    try {
      await rename.mutateAsync({ id, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename space.");
    }
  }

  async function handleDelete(id: string) {
    if (spaces.length <= 1) {
      setError("Keep at least one space.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await remove.mutateAsync(id);
      setConfirmId(null);
      if (activeSpaceId === id) {
        const next = spaces.find((s) => s.id !== id);
        if (next) setActiveSpaceId(next.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete space.");
    } finally {
      setBusy(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = spaces.findIndex((s) => s.id === active.id);
    const newIndex = spaces.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(spaces, oldIndex, newIndex).map((s, i) => ({
      id: s.id,
      sort: i,
    }));
    reorder.mutate(next);
  }

  return (
    <section id="spaces" className="scroll-mt-8 rounded-card border border-line bg-bg-1 p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
        Spaces
      </p>
      <p className="mt-2 text-sm text-text-lo">
        Workspaces like Originals or Edits. Each has its own board stages.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-text-lo">Loading spaces…</p>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={spaces.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="mt-4 space-y-2">
                {spaces.map((space) => (
                  <SortableSpaceRow
                    key={space.id}
                    space={space}
                    isActive={space.id === activeSpaceId}
                    confirmDelete={confirmId === space.id}
                    canDelete={spaces.length > 1}
                    onRename={handleRename}
                    onAskDelete={() => setConfirmId(space.id)}
                    onCancelDelete={() => setConfirmId(null)}
                    onConfirmDelete={() => handleDelete(space.id)}
                    busy={busy}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <form onSubmit={handleCreate} className="mt-4 flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New space name"
            />
            <Button type="submit" disabled={busy || !newName.trim()}>
              <Plus className="size-3.5" />
              Add
            </Button>
          </form>
        </>
      )}

      {error ? <p className="mt-3 text-sm text-warn">{error}</p> : null}
    </section>
  );
}

function SortableSpaceRow({
  space,
  isActive,
  confirmDelete,
  canDelete,
  onRename,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  busy,
}: {
  space: Space;
  isActive: boolean;
  confirmDelete: boolean;
  canDelete: boolean;
  onRename: (id: string, name: string) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  busy: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: space.id });
  const [name, setName] = React.useState(space.name);

  React.useEffect(() => {
    setName(space.name);
  }, [space.name]);

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "rounded-input border border-line bg-bg-2 px-2 py-1.5",
        isActive && "border-ice/35",
        isDragging && "ring-1 ring-ice/50"
      )}
    >
      <div className="flex items-center gap-2">
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
            if (name.trim() && name.trim() !== space.name) {
              onRename(space.id, name.trim());
            } else {
              setName(space.name);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-8 border-transparent bg-transparent px-1 focus-visible:border-line focus-visible:bg-bg-0"
        />
        {isActive ? (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-amber">
            Active
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-text-lo hover:text-warn"
          disabled={!canDelete}
          onClick={onAskDelete}
          aria-label={`Delete ${space.name}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {confirmDelete ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line px-1 pt-2 pb-1">
          <span className="text-xs text-warn">
            Deletes this space, its stages, and all tracks inside. Sure?
          </span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={onConfirmDelete}
          >
            Yes, delete
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancelDelete}>
            Cancel
          </Button>
        </div>
      ) : null}
    </li>
  );
}
