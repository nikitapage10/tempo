"use client";

import { Palette, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useTaskCategoryPalette } from "@/components/tasks/task-category-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useTaskCategoryMutations } from "@/hooks/use-task-categories";
import {
  normalizeTaskCategoryColor,
  type TaskCategoryDefinition,
} from "@/lib/tasks/categories";

function customKey(label: string) {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6);
  return `custom_${slug || "category"}_${suffix}`.slice(0, 40);
}

function CategoryRow({
  category,
  busy,
  canManage,
  onSave,
  onRemove,
}: {
  category: TaskCategoryDefinition;
  busy: boolean;
  canManage: boolean;
  onSave: (category: TaskCategoryDefinition) => void;
  onRemove: (key: string) => void;
}) {
  const [label, setLabel] = React.useState(category.label);
  const [color, setColor] = React.useState(category.color);
  React.useEffect(() => {
    setLabel(category.label);
    setColor(category.color);
  }, [category]);
  const normalizedColor = normalizeTaskCategoryColor(color);
  const changed = label.trim() !== category.label || normalizedColor !== category.color;
  return (
    <div className="grid items-center gap-2 rounded-input border border-line bg-bg-2/45 p-2 sm:grid-cols-[32px_minmax(0,1fr)_auto]">
      <input
        type="color"
        value={normalizedColor}
        onChange={(event) => setColor(event.target.value)}
        aria-label={`${category.label} color`}
        disabled={!canManage}
        className="size-8 cursor-pointer rounded-[6px] border border-line bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        maxLength={40}
        aria-label={`${category.label} category name`}
        disabled={!canManage}
      />
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!canManage || !changed || !label.trim() || busy}
          onClick={() =>
            onSave({ ...category, label: label.trim(), color: normalizedColor })
          }
        >
          Save
        </Button>
        {!category.locked ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={!canManage || busy}
            onClick={() => onRemove(category.key)}
            aria-label={`Delete ${category.label}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function TaskCategoryManager({
  open,
  onClose,
  canManage = true,
}: {
  open: boolean;
  onClose: () => void;
  canManage?: boolean;
}) {
  const { artistId, categories, customizable } = useTaskCategoryPalette();
  const mutations = useTaskCategoryMutations(artistId);
  const { toast } = useToast();
  const [newLabel, setNewLabel] = React.useState("");
  const [newColor, setNewColor] = React.useState("#38bdf8");
  const busy = mutations.save.isPending || mutations.remove.isPending;
  const enabled = canManage && customizable && !!artistId;

  async function save(category: TaskCategoryDefinition) {
    try {
      await mutations.save.mutateAsync(category);
      toast("Task category saved", "ok");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t save that category.");
    }
  }

  async function add() {
    if (!newLabel.trim()) return;
    await save({
      key: customKey(newLabel),
      label: newLabel.trim(),
      color: normalizeTaskCategoryColor(newColor),
      sort: 100 + categories.filter((category) => !category.locked).length * 10,
      locked: false,
    });
    setNewLabel("");
  }

  async function remove(key: string) {
    if (!window.confirm("Delete this category? Existing tasks will move to Other.")) return;
    try {
      await mutations.remove.mutateAsync(key);
      toast("Category deleted", "ok");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t delete that category.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title="Task categories"
        description="Choose the labels and colors that make work easiest to scan. Changes are shared with everyone who can see this workspace."
        onClose={onClose}
        className="max-h-[88vh]"
      >
        {!customizable ? (
          <div className="rounded-input border border-amber/30 bg-amber/10 px-3 py-2 text-xs leading-5 text-amber">
            The default task categories are active. Apply migration 108 to save custom labels, colors, and categories.
          </div>
        ) : !canManage ? (
          <div className="rounded-input border border-line bg-bg-2/45 px-3 py-2 text-xs leading-5 text-text-lo">
            You can use these categories, but changing the shared palette requires Tasks write access.
          </div>
        ) : null}
        <div className="space-y-2">
          {categories.map((category) => (
            <CategoryRow
              key={category.key}
              category={category}
              busy={busy}
              canManage={enabled}
              onSave={(value) => void save(value)}
              onRemove={(key) => void remove(key)}
            />
          ))}
        </div>
        <section className="rounded-card border border-line p-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-text-hi">
            <Palette className="size-4 text-ice" /> Add a category
          </h3>
          <div className="mt-2 flex gap-2">
            <input
              type="color"
              value={newColor}
              onChange={(event) => setNewColor(event.target.value)}
              aria-label="New task category color"
              disabled={!enabled}
              className="size-9 cursor-pointer rounded-[6px] border border-line bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Input
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              placeholder="Approvals"
              maxLength={40}
              disabled={!enabled}
            />
            <Button type="button" size="sm" disabled={!enabled || !newLabel.trim() || busy} onClick={() => void add()}>
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
