"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSessionAgenda, useSessionRoomMutations } from "@/hooks/use-session-rooms";
import { cn } from "@/lib/utils";

function SortableAgendaRow({
  id,
  body,
  done,
  onToggle,
}: {
  id: string;
  body: string;
  done: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("well flex items-center gap-2 px-2 py-1.5", isDragging && "opacity-60")}
    >
      <button type="button" className="text-text-lo hover:text-text-hi" aria-label="Reorder" {...attributes} {...listeners}>
        <GripVertical className="size-3.5" />
      </button>
      <input
        type="checkbox"
        className="size-3.5 accent-[var(--ice)]"
        checked={done}
        onChange={onToggle}
      />
      <span className={cn("flex-1 text-sm text-text-hi", done && "text-text-lo line-through")}>{body}</span>
    </li>
  );
}

export function SessionAgenda({
  roomId,
  artistId,
  openMeetId,
}: {
  roomId: string;
  artistId: string;
  openMeetId: string | null;
}) {
  const { data: items = [] } = useSessionAgenda(roomId);
  const mutations = useSessionRoomMutations(artistId, roomId);
  const user = useCurrentUser();
  const [draft, setDraft] = React.useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = items.map((item) => item.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    void mutations.reorderAgenda.mutateAsync(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          void mutations.addAgenda.mutateAsync(draft.trim()).then(() => setDraft(""));
        }}
      >
        <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add to the agenda" />
        <Button type="submit" size="sm" disabled={!draft.trim()}>
          Add
        </Button>
      </form>
      {items.length === 0 ? (
        <p className="text-sm text-text-lo">Nothing on the agenda yet. Add what you want to cover.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <SortableAgendaRow
                  key={item.id}
                  id={item.id}
                  body={item.body}
                  done={Boolean(item.done_at)}
                  onToggle={() =>
                    void mutations.updateAgenda.mutateAsync({
                      id: item.id,
                      patch: item.done_at
                        ? { done_at: null, done_by_user_id: null, done_in_meet_id: null }
                        : {
                            done_at: new Date().toISOString(),
                            done_by_user_id: user?.id ?? null,
                            done_in_meet_id: openMeetId,
                          },
                    })
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
