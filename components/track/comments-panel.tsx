"use client";

import * as React from "react";
import { ChevronDown, Reply as ReplyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useCommentMutations, useComments } from "@/hooks/use-comments";
import { useCollaborators } from "@/hooks/use-collaborators";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDuration, formatShortDate } from "@/lib/format";
import type { Comment, Version } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { VersionFilter } from "@/lib/api/comments";

type CommentFilter = "current" | "all";

type CommentsPanelProps = {
  trackId: string;
  versions: Version[];
  selectedVersionId: string | null;
  /** Track owner — enables "Owner"/"You" attribution chips (FEATURE-SPECS §13). */
  ownerUserId?: string;
  /** Ask the page to switch to `versionId` (if needed) and seek to `timestampSec`. */
  onRequestSeek: (versionId: string, timestampSec: number) => void;
  /** Current playhead position of the loaded waveform, for "pin to current time". */
  currentTimeSec: number;
  /** Set by the player's "Add comment here" button; consumed once applied. */
  prefillTimestampSec: number | null;
  onPrefillConsumed: () => void;
};

/** Resolves author_user_id -> a short display label without a users table (FEATURE-SPECS §13). */
const AttributionContext = React.createContext<(userId: string | null) => string | null>(
  () => null
);

type Thread = {
  root: Comment;
  replies: Comment[];
};

export function CommentsPanel({
  trackId,
  versions,
  selectedVersionId,
  ownerUserId,
  onRequestSeek,
  currentTimeSec,
  prefillTimestampSec,
  onPrefillConsumed,
}: CommentsPanelProps) {
  const [filter, setFilter] = React.useState<CommentFilter>("current");
  const versionFilter: VersionFilter =
    filter === "current" ? selectedVersionId ?? "all" : "all";

  const { data: comments = [], isLoading } = useComments(trackId, versionFilter);
  const mutations = useCommentMutations(trackId, versionFilter);
  const { toast } = useToast();
  const currentUser = useCurrentUser();
  const { data: collaborators = [] } = useCollaborators(trackId);

  const attributionFor = React.useCallback(
    (userId: string | null): string | null => {
      if (!userId) return null;
      if (currentUser && userId === currentUser.id) return "You";
      if (ownerUserId && userId === ownerUserId) return "Owner";
      const collab = collaborators.find((c) => c.user_id === userId);
      if (collab?.invited_email) return collab.invited_email;
      return "Collaborator";
    },
    [currentUser, ownerUserId, collaborators]
  );

  const [resolvedOpen, setResolvedOpen] = React.useState(false);

  const versionById = React.useMemo(() => {
    const map = new Map<string, Version>();
    versions.forEach((v) => map.set(v.id, v));
    return map;
  }, [versions]);

  const threads = React.useMemo<Thread[]>(() => {
    const roots = comments.filter((c) => !c.parent_id);
    const repliesByParent = new Map<string, Comment[]>();
    comments
      .filter((c) => c.parent_id)
      .forEach((c) => {
        const list = repliesByParent.get(c.parent_id!) ?? [];
        list.push(c);
        repliesByParent.set(c.parent_id!, list);
      });
    return roots.map((root) => ({
      root,
      replies: (repliesByParent.get(root.id) ?? []).sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      ),
    }));
  }, [comments]);

  const unresolvedThreads = threads.filter((t) => !t.root.resolved);
  const resolvedThreads = threads.filter((t) => t.root.resolved);

  function handleError(err: unknown, fallback: string) {
    toast(err instanceof Error ? err.message : fallback);
  }

  async function createTopLevel(text: string, timestampSec: number | null) {
    if (!selectedVersionId) return;
    try {
      await mutations.create.mutateAsync({
        versionId: selectedVersionId,
        text,
        timestampSec,
      });
    } catch (err) {
      handleError(err, "Couldn’t post that comment — try again.");
      throw err;
    }
  }

  async function createReply(parent: Comment, text: string) {
    try {
      await mutations.create.mutateAsync({
        versionId: parent.version_id,
        text,
        parentId: parent.id,
      });
    } catch (err) {
      handleError(err, "Couldn’t post that reply — try again.");
      throw err;
    }
  }

  async function handleEdit(id: string, text: string) {
    try {
      await mutations.update.mutateAsync({ id, patch: { text } });
    } catch (err) {
      handleError(err, "Couldn’t save that edit.");
    }
  }

  async function handleResolve(id: string) {
    try {
      await mutations.resolve.mutateAsync(id);
    } catch (err) {
      handleError(err, "Couldn’t resolve that comment.");
    }
  }

  async function handleReopen(id: string) {
    try {
      await mutations.reopen.mutateAsync(id);
    } catch (err) {
      handleError(err, "Couldn’t reopen that comment.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await mutations.remove.mutateAsync(id);
    } catch (err) {
      handleError(err, "Couldn’t delete that comment.");
    }
  }

  if (!versions.length) {
    return (
      <section className="rounded-card border border-dashed border-line bg-bg-1/60 p-4">
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Comments
        </h2>
        <p className="text-sm text-text-lo">
          Upload a bounce first — comments pin to a specific version’s waveform.
        </p>
      </section>
    );
  }

  return (
    <AttributionContext.Provider value={attributionFor}>
    <section className="rounded-card border border-line bg-bg-1 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Comments
        </h2>
        <div className="flex gap-1.5">
          <Chip active={filter === "current"} onClick={() => setFilter("current")}>
            This version
          </Chip>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All versions
          </Chip>
        </div>
      </div>

      <NewCommentComposer
        disabled={!selectedVersionId || mutations.create.isPending}
        currentTimeSec={currentTimeSec}
        prefillTimestampSec={prefillTimestampSec}
        onPrefillConsumed={onPrefillConsumed}
        onSubmit={createTopLevel}
      />

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-card bg-bg-2" />
        ) : threads.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-lo">
            No comments yet. Play the bounce and pin one at the moment it happens.
          </p>
        ) : (
          <>
            {unresolvedThreads.length === 0 ? (
              <p className="py-2 text-center text-sm text-text-lo">
                No open comments — nice and clear.
              </p>
            ) : (
              unresolvedThreads.map((thread) => (
                <ThreadRow
                  key={thread.root.id}
                  thread={thread}
                  version={versionById.get(thread.root.version_id)}
                  showVersionBadge={filter === "all"}
                  onSeek={onRequestSeek}
                  onEdit={handleEdit}
                  onResolve={handleResolve}
                  onReopen={handleReopen}
                  onDelete={handleDelete}
                  onReply={createReply}
                  replyBusy={mutations.create.isPending}
                />
              ))
            )}

            {resolvedThreads.length > 0 ? (
              <div className="border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setResolvedOpen((v) => !v)}
                  className="flex items-center gap-1 text-[11px] text-text-lo hover:text-text-hi"
                  aria-expanded={resolvedOpen}
                >
                  <ChevronDown
                    className={cn(
                      "size-3 transition-transform duration-hover",
                      resolvedOpen && "rotate-180"
                    )}
                  />
                  {resolvedOpen ? "Hide" : "Show"} resolved ({resolvedThreads.length})
                </button>
                {resolvedOpen ? (
                  <div className="mt-2 space-y-3">
                    {resolvedThreads.map((thread) => (
                      <ThreadRow
                        key={thread.root.id}
                        thread={thread}
                        version={versionById.get(thread.root.version_id)}
                        showVersionBadge={filter === "all"}
                        onSeek={onRequestSeek}
                        onEdit={handleEdit}
                        onResolve={handleResolve}
                        onReopen={handleReopen}
                        onDelete={handleDelete}
                        onReply={createReply}
                        replyBusy={mutations.create.isPending}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
    </AttributionContext.Provider>
  );
}

function NewCommentComposer({
  disabled,
  currentTimeSec,
  prefillTimestampSec,
  onPrefillConsumed,
  onSubmit,
}: {
  disabled: boolean;
  currentTimeSec: number;
  prefillTimestampSec: number | null;
  onPrefillConsumed: () => void;
  onSubmit: (text: string, timestampSec: number | null) => Promise<void>;
}) {
  const [text, setText] = React.useState("");
  const [pinned, setPinned] = React.useState(true);
  const [pinnedAt, setPinnedAt] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (prefillTimestampSec == null) return;
    setPinned(true);
    setPinnedAt(prefillTimestampSec);
    textareaRef.current?.focus();
    onPrefillConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per prefill signal
  }, [prefillTimestampSec]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setBusy(true);
    try {
      await onSubmit(trimmed, pinned ? pinnedAt || currentTimeSec : null);
      setText("");
    } catch {
      /* toast already shown by caller */
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2 rounded-card border border-line bg-bg-2/40 p-3"
    >
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Vocal’s a little pitchy here…"
        rows={2}
        disabled={disabled}
        maxLength={2000}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-text-lo">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => {
              setPinned(e.target.checked);
              if (e.target.checked) setPinnedAt(currentTimeSec);
            }}
            disabled={disabled}
          />
          Pin to{" "}
          <span className="font-mono text-amber">
            {formatDuration(pinned ? pinnedAt || currentTimeSec : currentTimeSec)}
          </span>
        </label>
        <Button type="submit" size="sm" disabled={disabled || busy || !text.trim()}>
          {busy ? "Posting…" : "Comment"}
        </Button>
      </div>
    </form>
  );
}

function ThreadRow({
  thread,
  version,
  showVersionBadge,
  onSeek,
  onEdit,
  onResolve,
  onReopen,
  onDelete,
  onReply,
  replyBusy,
}: {
  thread: Thread;
  version: Version | undefined;
  showVersionBadge: boolean;
  onSeek: (versionId: string, timestampSec: number) => void;
  onEdit: (id: string, text: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
  onReopen: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReply: (parent: Comment, text: string) => Promise<void>;
  replyBusy: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-bg-2/40 p-3",
        thread.root.resolved && "opacity-70"
      )}
    >
      <CommentRow
        comment={thread.root}
        version={version}
        showVersionBadge={showVersionBadge}
        onSeek={onSeek}
        onEdit={onEdit}
        onResolve={onResolve}
        onReopen={onReopen}
        onDelete={onDelete}
        replyCount={thread.replies.length}
      />
      {thread.replies.length > 0 ? (
        <div className="ml-4 mt-2 space-y-2 border-l border-line pl-3">
          {thread.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              version={version}
              showVersionBadge={false}
              onSeek={onSeek}
              onEdit={onEdit}
              onResolve={onResolve}
              onReopen={onReopen}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
      <ReplyComposer parent={thread.root} onReply={onReply} busy={replyBusy} />
    </div>
  );
}

function CommentRow({
  comment,
  version,
  showVersionBadge,
  onSeek,
  onEdit,
  onResolve,
  onReopen,
  onDelete,
  replyCount,
}: {
  comment: Comment;
  version: Version | undefined;
  showVersionBadge: boolean;
  onSeek: (versionId: string, timestampSec: number) => void;
  onEdit: (id: string, text: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
  onReopen: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  replyCount?: number;
}) {
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(comment.text);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const attributionFor = React.useContext(AttributionContext);
  const authorLabel = comment.guest_name ? null : attributionFor(comment.author_user_id);

  React.useEffect(() => {
    setText(comment.text);
  }, [comment.text]);

  async function saveEdit() {
    const trimmed = text.trim();
    if (!trimmed || trimmed === comment.text) {
      setEditing(false);
      setText(comment.text);
      return;
    }
    setBusy(true);
    try {
      await onEdit(comment.id, trimmed);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="text-sm">
      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-text-lo">
        {comment.timestamp_sec != null ? (
          <button
            type="button"
            onClick={() => onSeek(comment.version_id, comment.timestamp_sec!)}
            className="rounded-chip bg-ice/15 px-1.5 py-0.5 text-ice hover:bg-ice/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            aria-label={`Seek to ${formatDuration(comment.timestamp_sec)}`}
          >
            {formatDuration(comment.timestamp_sec)}
          </button>
        ) : (
          <span className="rounded-chip bg-bg-1 px-1.5 py-0.5 text-text-lo">general</span>
        )}
        {showVersionBadge && version ? (
          <span className="text-amber">v{version.version_no}</span>
        ) : null}
        {comment.guest_name ? (
          <span className="rounded-chip bg-violet/15 px-1.5 py-0.5 text-violet">
            Guest: {comment.guest_name}
          </span>
        ) : authorLabel ? (
          <span className="text-text-hi">{authorLabel}</span>
        ) : null}
        <span>{formatShortDate(comment.created_at)}</span>
        {comment.resolved ? (
          <span className="text-ok">resolved</span>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-1.5 space-y-1.5">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            autoFocus
            maxLength={2000}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void saveEdit()}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setText(comment.text);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-text-hi">{comment.text}</p>
      )}

      {!editing ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px]">
          <button
            type="button"
            className="text-text-lo hover:text-ice"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          {comment.resolved ? (
            <button
              type="button"
              className="text-text-lo hover:text-ice"
              onClick={() => void onReopen(comment.id)}
            >
              Reopen
            </button>
          ) : (
            <button
              type="button"
              className="text-text-lo hover:text-ok"
              onClick={() => void onResolve(comment.id)}
            >
              Resolve
            </button>
          )}
          {confirmingDelete ? (
            <span className="flex items-center gap-1.5">
              <span className="text-warn">
                Delete{replyCount ? ` (+ ${replyCount} repl${replyCount === 1 ? "y" : "ies"})` : ""}?
              </span>
              <button
                type="button"
                className="text-warn hover:underline"
                onClick={() => void onDelete(comment.id)}
              >
                Yes
              </button>
              <button
                type="button"
                className="text-text-lo hover:text-text-hi"
                onClick={() => setConfirmingDelete(false)}
              >
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="text-text-lo hover:text-warn"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}

function ReplyComposer({
  parent,
  onReply,
  busy,
}: {
  parent: Comment;
  onReply: (parent: Comment, text: string) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-1 text-[11px] text-text-lo hover:text-ice"
      >
        <ReplyIcon className="size-3" />
        Reply
      </button>
    );
  }

  return (
    <form
      className="mt-2 space-y-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed) return;
        setSubmitting(true);
        try {
          await onReply(parent, trimmed);
          setText("");
          setOpen(false);
        } catch {
          /* toast already shown */
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Reply…"
        rows={1}
        autoFocus
        maxLength={2000}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy || submitting || !text.trim()}>
          {submitting ? "Posting…" : "Reply"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setText("");
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}