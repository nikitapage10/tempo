"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import * as React from "react";
import type { BoardNote } from "@/lib/types";
import { cn } from "@/lib/utils";

export function noteDragId(noteId: string) {
  return `note:${noteId}`;
}

export function parseNoteDragId(id: string): string | null {
  return id.startsWith("note:") ? id.slice(5) : null;
}

type BoardNoteCardProps = {
  note: BoardNote;
  compact?: boolean;
  isDragOverlay?: boolean;
  onSave: (patch: { title: string; body: string | null }) => void;
  onDelete: () => void;
};

export function BoardNoteCard({
  note,
  compact,
  isDragOverlay,
  onSave,
  onDelete,
}: BoardNoteCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: noteDragId(note.id),
      data: { note, kind: "note" as const },
      disabled: isDragOverlay,
    });

  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(note.title);
  const [body, setBody] = React.useState(note.body ?? "");

  React.useEffect(() => {
    if (!editing) {
      setTitle(note.title);
      setBody(note.body ?? "");
    }
  }, [note.title, note.body, editing]);

  const style = isDragOverlay
    ? undefined
    : {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
      };

  const dragHandleProps = isDragOverlay
    ? {}
    : { ...listeners, ...attributes };

  function commit() {
    const nextTitle = title.trim() || note.title;
    const nextBody = body.trim() || null;
    setEditing(false);
    if (nextTitle !== note.title || nextBody !== (note.body ?? null)) {
      onSave({ title: nextTitle, body: nextBody });
    }
  }

  return (
    <article
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      className={cn(
        "rounded-card border border-dashed border-line/80 bg-bg-0/50",
        compact ? "px-2 py-1.5" : "px-2.5 py-2",
        isDragOverlay && "cursor-grabbing shadow-raise ring-1 ring-amber/40",
        isDragging && !isDragOverlay && "opacity-40"
      )}
    >
      {editing && !isDragOverlay ? (
        <div className="space-y-1.5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setTitle(note.title);
                setBody(note.body ?? "");
                setEditing(false);
              }
            }}
            className="h-7 w-full rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            placeholder="Note title"
            aria-label="Note title"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={compact ? 2 : 3}
            className="w-full resize-none rounded-input border border-line bg-bg-2 px-2 py-1.5 text-[11px] text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            placeholder="Optional details…"
            aria-label="Note body"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="text-[10px] text-text-lo/50 hover:text-text-lo"
              onClick={() => {
                setTitle(note.title);
                setBody(note.body ?? "");
                setEditing(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="text-[10px] text-ice hover:underline"
              onClick={commit}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            !isDragOverlay && "cursor-grab active:cursor-grabbing touch-none"
          )}
          {...dragHandleProps}
        >
          <button
            type="button"
            className={cn(
              "block w-full text-left font-medium text-text-hi hover:text-ice",
              compact ? "text-xs" : "text-sm"
            )}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => !isDragOverlay && setEditing(true)}
          >
            {note.title}
          </button>
          {note.body?.trim() ? (
            <p
              className={cn(
                "mt-1 whitespace-pre-wrap text-text-lo",
                compact ? "text-[10px] line-clamp-2" : "text-[11px] line-clamp-4"
              )}
            >
              {note.body}
            </p>
          ) : null}
          {!isDragOverlay ? (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[9px] uppercase tracking-wide text-text-lo/35">
                Note
              </span>
              <button
                type="button"
                className="text-[10px] text-text-lo/40 hover:text-warn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                Delete
              </button>
            </div>
          ) : (
            <p className="mt-1 text-[9px] uppercase tracking-wide text-text-lo/35">
              Note
            </p>
          )}
        </div>
      )}
    </article>
  );
}
