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
import { ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useChecklist,
  useChecklistMutations,
} from "@/hooks/use-checklist";
import { useTemplateMutations, useTemplates } from "@/hooks/use-templates";
import type { ChecklistItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type TrackChecklistProps = {
  trackId: string;
};

export function TrackChecklist({ trackId }: TrackChecklistProps) {
  const { data: items = [], isLoading } = useChecklist(trackId);
  const { create, update, remove, reorder, applyTemplate } =
    useChecklistMutations(trackId);
  const templatesQuery = useTemplates();
  const { create: saveTemplate } = useTemplateMutations();

  const [newText, setNewText] = React.useState("");
  const [templateMenuOpen, setTemplateMenuOpen] = React.useState(false);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [templateName, setTemplateName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    setError(null);
    try {
      await create.mutateAsync(text);
      setNewText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item.");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex).map((item, sort) => ({
      id: item.id,
      sort,
    }));
    reorder.mutate(next);
  }

  async function handleApply(templateId: string) {
    const tmpl = (templatesQuery.data ?? []).find((t) => t.id === templateId);
    if (!tmpl) return;
    setTemplateMenuOpen(false);
    setBusy(true);
    setError(null);
    try {
      await applyTemplate.mutateAsync(tmpl.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not apply template."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    const name = templateName.trim();
    if (!name) return;
    if (items.length === 0) {
      setError("Add checklist items before saving a template.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveTemplate.mutateAsync({
        name,
        items: items.map((item, sort) => ({ text: item.text, sort })),
      });
      setSaveOpen(false);
      setTemplateName("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save template."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-bg-1 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Checklist
        </h2>
        <span className="font-mono text-[11px] text-text-lo">
          {total === 0 ? "—" : `${pct}%`}
        </span>
      </div>

      <div
        className="mb-3 h-1 overflow-hidden rounded-full bg-bg-2"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Checklist completion"
      >
        <div
          className="h-full rounded-full transition-[width] duration-hover"
          style={{
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, var(--ice) 0%, var(--amber) 100%)",
          }}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || templatesQuery.isLoading}
            onClick={() => setTemplateMenuOpen((v) => !v)}
          >
            Apply template
            <ChevronDown className="size-3.5" />
          </Button>
          {templateMenuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close menu"
                onClick={() => setTemplateMenuOpen(false)}
              />
              <ul className="absolute left-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-input border border-line bg-bg-2 py-1 shadow-raise">
                {(templatesQuery.data ?? []).length === 0 ? (
                  <li className="px-3 py-2 text-xs text-text-lo">
                    No templates yet
                  </li>
                ) : (
                  (templatesQuery.data ?? []).map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-1.5 text-left text-sm text-text-hi transition-colors duration-hover hover:bg-bg-1"
                        onClick={() => void handleApply(t.id)}
                      >
                        {t.name}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || items.length === 0}
          onClick={() => {
            setTemplateName("");
            setSaveOpen(true);
          }}
        >
          Save as template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded-input bg-bg-2"
            />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-1">
              {items.map((item) => (
                <SortableChecklistRow
                  key={item.id}
                  item={item}
                  onToggle={() =>
                    update.mutate({
                      id: item.id,
                      patch: { done: !item.done },
                    })
                  }
                  onRename={(text) =>
                    update.mutate({ id: item.id, patch: { text } })
                  }
                  onDelete={() => remove.mutate(item.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {items.length === 0 && !isLoading ? (
        <p className="mb-3 text-sm text-text-lo">
          No items yet. Add one, or apply a template.
        </p>
      ) : null}

      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <Input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add a checklist item"
          className="h-8"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={!newText.trim()}>
          <Plus className="size-3.5" />
          Add
        </Button>
      </form>

      {error ? <p className="mt-2 text-sm text-warn">{error}</p> : null}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent
          title="Save as template"
          description="Reuse this checklist on other tracks."
          onClose={() => setSaveOpen(false)}
        >
          <form onSubmit={handleSaveTemplate} className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Vocal edit pass"
                autoFocus
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSaveOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !templateName.trim()}>
                {busy ? "Saving…" : "Save template"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SortableChecklistRow({
  item,
  onToggle,
  onRename,
  onDelete,
}: {
  item: ChecklistItem;
  onToggle: () => void;
  onRename: (text: string) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(item.text);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setText(item.text);
  }, [item.text]);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    const next = text.trim();
    if (!next || next === item.text) {
      setText(item.text);
      return;
    }
    onRename(next);
  }

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "group flex items-center gap-1.5 rounded-input border border-transparent px-1 py-1 hover:border-line hover:bg-bg-2/50",
        isDragging && "z-10 border-ice/40 bg-bg-2 shadow-raise"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none p-1 text-text-lo/50 hover:text-text-lo active:cursor-grabbing"
        aria-label="Reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded border transition-colors duration-hover",
          item.done
            ? "border-ok bg-ok/20 text-ok"
            : "border-line bg-bg-2 hover:border-ice"
        )}
        aria-label={item.done ? "Mark incomplete" : "Mark done"}
      >
        {item.done ? (
          <span className="block size-2 rounded-sm bg-ok" />
        ) : null}
      </button>
      {editing ? (
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setText(item.text);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded-input border border-line bg-bg-2 px-2 py-0.5 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm",
            item.done ? "text-text-lo line-through" : "text-text-hi"
          )}
        >
          {item.text}
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="rounded-input p-1 text-text-lo opacity-0 transition-opacity duration-hover hover:text-warn group-hover:opacity-100 focus-visible:opacity-100"
        aria-label="Delete item"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}
