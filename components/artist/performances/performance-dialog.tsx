"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePerformanceMutations } from "@/hooks/use-performances";
import type {
  Performance,
  PerformanceContext,
  PerformanceRole,
} from "@/lib/api/performances";

const ROLES: { value: PerformanceRole; label: string }[] = [
  { value: "headline", label: "Headline" },
  { value: "performer", label: "Performer" },
  { value: "support", label: "Support" },
  { value: "dj", label: "DJ" },
  { value: "host", label: "Host" },
  { value: "crew", label: "Crew" },
];

const CONTEXTS: { value: PerformanceContext; label: string }[] = [
  { value: "show", label: "Show" },
  { value: "festival", label: "Festival" },
  { value: "residency", label: "Residency" },
  { value: "livestream", label: "Livestream" },
  { value: "radio", label: "Radio" },
  { value: "session", label: "Session" },
];

/**
 * Log a performance — the only way STAGE PRESENCE gets a real number.
 * Deliberately a manual form, not an auto-import: a number an attribute
 * depends on should only ever grow from something the artist confirmed
 * actually happened.
 */
export function PerformanceDialog({
  artistId,
  open,
  onOpenChange,
  editing,
  prefill,
}: {
  artistId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Performance | null;
  prefill?: { title: string; performedOn: string; calendarEventId: string } | null;
}) {
  const { create, update } = usePerformanceMutations(artistId);
  const { toast } = useToast();

  const [title, setTitle] = React.useState("");
  const [performedOn, setPerformedOn] = React.useState("");
  const [role, setRole] = React.useState<PerformanceRole>("performer");
  const [context, setContext] = React.useState<PerformanceContext>("show");
  const [festivalName, setFestivalName] = React.useState("");
  const [venue, setVenue] = React.useState("");
  const [city, setCity] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setPerformedOn(editing.performedOn);
      setRole(editing.role);
      setContext(editing.context);
      setFestivalName(editing.festivalName ?? "");
      setVenue(editing.venue ?? "");
      setCity(editing.city ?? "");
    } else {
      setTitle(prefill?.title ?? "");
      setPerformedOn(prefill?.performedOn ?? new Date().toISOString().slice(0, 10));
      setRole("performer");
      setContext("show");
      setFestivalName("");
      setVenue("");
      setCity("");
    }
  }, [open, editing, prefill]);

  const busy = create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !performedOn) return;
    try {
      const input = {
        title: title.trim(),
        performedOn,
        role,
        context,
        festivalName: festivalName.trim() || null,
        venue: venue.trim() || null,
        city: city.trim() || null,
        calendarEventId: prefill?.calendarEventId ?? null,
      };
      if (editing) {
        await update.mutateAsync({ id: editing.id, input });
      } else {
        await create.mutateAsync(input);
      }
      onOpenChange(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t save that performance.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent
          title={editing ? "Edit performance" : "Log a performance"}
          description="Real shows played — this is what feeds Stage Presence."
          onClose={() => onOpenChange(false)}
        >
          <form onSubmit={submit} className="space-y-3">
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                required
                className="h-9 w-full rounded-input border border-line bg-bg-2 px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                placeholder="e.g. Owl's Nest, late set"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <input
                  type="date"
                  value={performedOn}
                  onChange={(e) => setPerformedOn(e.target.value)}
                  required
                  className="h-9 w-full rounded-input border border-line bg-bg-2 px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                />
              </Field>
              <Field label="Role">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as PerformanceRole)}
                  className="h-9 w-full rounded-input border border-line bg-bg-2 px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Context">
                <select
                  value={context}
                  onChange={(e) => setContext(e.target.value as PerformanceContext)}
                  className="h-9 w-full rounded-input border border-line bg-bg-2 px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                >
                  {CONTEXTS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              {context === "festival" ? (
                <Field label="Festival name">
                  <input
                    value={festivalName}
                    onChange={(e) => setFestivalName(e.target.value)}
                    maxLength={160}
                    className="h-9 w-full rounded-input border border-line bg-bg-2 px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                  />
                </Field>
              ) : (
                <Field label="City">
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={120}
                    className="h-9 w-full rounded-input border border-line bg-bg-2 px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                  />
                </Field>
              )}
            </div>

            <Field label="Venue">
              <input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                maxLength={160}
                className="h-9 w-full rounded-input border border-line bg-bg-2 px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !title.trim() || !performedOn}>
                {busy ? "Saving…" : editing ? "Save" : "Log it"}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono mb-1 block">{label}</span>
      {children}
    </label>
  );
}
