"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useSessionMutations, useSessions } from "@/hooks/use-sessions";
import { useVersions } from "@/hooks/use-versions";
import { formatDuration, formatShortDate, localDateString } from "@/lib/format";
import type { Session, SessionStatus, Version } from "@/lib/types";
import { cn } from "@/lib/utils";

type SessionLogProps = {
  trackId: string;
};

const STATUS_LABEL: Record<SessionStatus, string> = {
  active: "In progress",
  completed: "Completed",
  abandoned: "Abandoned",
};

const STATUS_CLASS: Record<SessionStatus, string> = {
  active: "text-amber",
  completed: "text-ok",
  abandoned: "text-text-lo",
};

export function SessionLog({ trackId }: SessionLogProps) {
  const { data: sessions = [], isLoading } = useSessions(trackId);
  const { data: versions = [] } = useVersions(trackId);
  const { create } = useSessionMutations(trackId);
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [linkToday, setLinkToday] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const todayUpload = React.useMemo(() => {
    const today = localDateString();
    return (
      versions.find((v) => v.created_at.slice(0, 10) === today) ?? null
    );
  }, [versions]);

  React.useEffect(() => {
    if (todayUpload) setLinkToday(true);
  }, [todayUpload]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    try {
      await create.mutateAsync({
        note,
        versionId: linkToday && todayUpload ? todayUpload.id : null,
      });
      setNote("");
      setOpen(false);
      toast("Session logged", "ok");
    } catch (err) {
      toast(
        err instanceof Error
          ? err.message
          : "Couldn’t log the session — try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-bg-1 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Session log
        </h2>
        {!open ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Log session
          </Button>
        ) : null}
      </div>

      {open ? (
        <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-card border border-line bg-bg-2/50 p-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Worked on drums, rewrote drop…"
            rows={3}
            autoFocus
          />
          {todayUpload ? (
            <label className="flex items-start gap-2 text-xs text-text-lo">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={linkToday}
                onChange={(e) => setLinkToday(e.target.checked)}
              />
              <span>
                Link to today’s upload{" "}
                <span className="font-mono text-amber">
                  v{todayUpload.version_no}
                </span>
                {todayUpload.label ? ` — ${todayUpload.label}` : ""}
              </span>
            </label>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || !note.trim()}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setNote("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <ul className="space-y-2">
        {isLoading ? (
          <li className="h-12 animate-pulse rounded-card bg-bg-2" />
        ) : sessions.length === 0 ? (
          <li className="py-3 text-center text-sm text-text-lo">
            No sessions yet. Log one when you sit down with this track.
          </li>
        ) : (
          sessions.map((s) => (
            <SessionRow key={s.id} session={s} versions={versions} />
          ))
        )}
      </ul>
    </section>
  );
}

/** A focus session has a goal/status/elapsed_sec; a quick "Log session" row is just a note. */
function isFocusSession(s: Session): boolean {
  return s.goal != null || s.status !== "completed" || s.elapsed_sec != null;
}

function SessionRow({
  session: s,
  versions,
}: {
  session: Session;
  versions: Version[];
}) {
  if (!isFocusSession(s)) {
    return (
      <li className="rounded-card border border-line bg-bg-2/40 px-3 py-2">
        <p className="text-sm text-text-hi">{s.note}</p>
        <p className="mt-1 font-mono text-[11px] text-text-lo">
          {formatShortDate(s.logged_at)}
          {s.version_id ? (
            <VersionChip versions={versions} versionId={s.version_id} />
          ) : null}
        </p>
      </li>
    );
  }

  return (
    <li className="rounded-card border border-line bg-bg-2/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-hi">
          {s.goal || <span className="text-text-lo">Focus session</span>}
        </p>
        <span className={cn("font-mono text-[10px] uppercase tracking-wider", STATUS_CLASS[s.status])}>
          {STATUS_LABEL[s.status]}
        </span>
      </div>
      {s.note ? <p className="mt-1 text-xs text-text-lo">{s.note}</p> : null}
      {s.outcome ? (
        <p className="mt-1 text-xs text-text-lo">
          <span className="text-text-lo/70">Left: </span>
          {s.outcome}
        </p>
      ) : null}
      {s.next_action_after ? (
        <p className="mt-1 text-xs text-text-lo">
          <span className="text-text-lo/70">Next: </span>
          {s.next_action_after}
        </p>
      ) : null}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] text-text-lo">
        <span>{formatShortDate(s.logged_at)}</span>
        {s.elapsed_sec != null ? (
          <>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {formatDuration(s.elapsed_sec)}
            </span>
          </>
        ) : null}
        {s.version_id ? (
          <VersionChip versions={versions} versionId={s.version_id} />
        ) : null}
      </p>
    </li>
  );
}

function VersionChip({
  versions,
  versionId,
}: {
  versions: Version[];
  versionId: string;
}) {
  const v = versions.find((x) => x.id === versionId);
  if (!v) return null;
  return (
    <span className="text-amber">
      {" · "}v{v.version_no}
    </span>
  );
}
