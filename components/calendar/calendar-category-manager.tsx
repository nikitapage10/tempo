"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useCalendarCategories, useCalendarCategoryMutations } from "@/hooks/use-calendar";
import { normalizeCategoryColor, type CalendarCategory } from "@/lib/calendar/categories";

function customKey(label: string) {
  const slug = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 28);
  return `custom_${slug || Date.now().toString(36)}`;
}

function CategoryRow({ category, onSave, onRemove, busy }: { category: CalendarCategory; onSave: (category: CalendarCategory) => void; onRemove: (key: string) => void; busy: boolean }) {
  const [label, setLabel] = React.useState(category.label);
  const [color, setColor] = React.useState(category.color);
  React.useEffect(() => { setLabel(category.label); setColor(category.color); }, [category]);
  const changed = label.trim() !== category.label || normalizeCategoryColor(color) !== category.color;
  return (
    <div className="grid items-center gap-2 rounded-input border border-line bg-bg-2/45 p-2 sm:grid-cols-[32px_minmax(0,1fr)_auto]">
      <input type="color" value={normalizeCategoryColor(color)} onChange={(event) => setColor(event.target.value)} aria-label={`${category.label} color`} className="size-8 cursor-pointer rounded-[6px] border border-line bg-transparent p-0.5" />
      <Input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={40} aria-label={`${category.label} category name`} />
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="secondary" disabled={!changed || !label.trim() || busy} onClick={() => onSave({ ...category, label: label.trim(), color: normalizeCategoryColor(color) })}>Save</Button>
        {!category.locked ? <Button type="button" size="icon" variant="ghost" disabled={busy} onClick={() => onRemove(category.key)} aria-label={`Delete ${category.label}`}><Trash2 className="size-3.5" /></Button> : null}
      </div>
    </div>
  );
}

export function CalendarCategoryManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const query = useCalendarCategories();
  const mutations = useCalendarCategoryMutations();
  const { toast } = useToast();
  const [newLabel, setNewLabel] = React.useState("");
  const [newColor, setNewColor] = React.useState("#d946ef");
  const categories = query.data?.categories ?? [];
  const busy = mutations.save.isPending || mutations.remove.isPending;

  async function save(category: CalendarCategory) {
    try { await mutations.save.mutateAsync(category); toast("Calendar category saved", "ok"); }
    catch (error) { toast(error instanceof Error ? error.message : "Couldn’t save that category."); }
  }

  async function add() {
    if (!newLabel.trim()) return;
    const eventCategories = categories.filter((category) => category.group === "event");
    await save({ key: customKey(newLabel), label: newLabel.trim(), color: normalizeCategoryColor(newColor), group: "event", sort: 200 + eventCategories.length * 10, locked: false });
    setNewLabel("");
  }

  async function remove(key: string) {
    if (!window.confirm("Delete this category? Existing events will move to Other.")) return;
    try { await mutations.remove.mutateAsync(key); toast("Category deleted", "ok"); }
    catch (error) { toast(error instanceof Error ? error.message : "Couldn’t delete that category."); }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent title="Calendar categories" description="Choose the labels and colors that make your schedule easiest to scan." onClose={onClose} className="max-h-[88vh]">
        {query.data?.customizable === false ? <div className="rounded-input border border-amber/30 bg-amber/10 px-3 py-2 text-xs leading-5 text-amber">The default color scheme is active. Apply migration 075 to save custom labels, colors, and new event categories.</div> : null}
        <div className="space-y-5">
          <section>
            <h3 className="label-mono mb-2">Workspace dates</h3>
            <div className="space-y-2">{categories.filter((category) => category.group === "source").map((category) => <CategoryRow key={category.key} category={category} onSave={(value) => void save(value)} onRemove={(key) => void remove(key)} busy={busy || query.data?.customizable === false} />)}</div>
          </section>
          <section>
            <h3 className="label-mono mb-2">Event categories</h3>
            <div className="space-y-2">{categories.filter((category) => category.group === "event").map((category) => <CategoryRow key={category.key} category={category} onSave={(value) => void save(value)} onRemove={(key) => void remove(key)} busy={busy || query.data?.customizable === false} />)}</div>
          </section>
          <section className="rounded-card border border-line p-3">
            <h3 className="text-sm font-medium text-text-hi">Add an event category</h3>
            <div className="mt-2 flex gap-2">
              <input type="color" value={newColor} onChange={(event) => setNewColor(event.target.value)} aria-label="New category color" className="size-9 cursor-pointer rounded-[6px] border border-line bg-transparent p-0.5" />
              <Input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Listening party" maxLength={40} />
              <Button type="button" size="sm" disabled={!newLabel.trim() || busy || query.data?.customizable === false} onClick={() => void add()}><Plus className="size-3.5" /> Add</Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
