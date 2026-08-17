"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskRow } from "@/components/tasks/task-row";
import { useToast } from "@/components/ui/toast";
import { useTaskMutations } from "@/hooks/use-tasks";
import { useSessionRoomMutations, useSessionRoomTasks } from "@/hooks/use-session-rooms";
import type { SessionRoomMember } from "@/lib/types";

export function SessionTasks({
  roomId,
  artistId,
  spaceId,
  members,
  assignees,
}: {
  roomId: string;
  artistId: string;
  spaceId: string;
  members: SessionRoomMember[];
  assignees: { id: string; name: string }[];
}) {
  const { toast } = useToast();
  const { data: tasks = [] } = useSessionRoomTasks(roomId, spaceId);
  const mutations = useSessionRoomMutations(artistId, roomId);
  const taskMutations = useTaskMutations(spaceId);
  const [title, setTitle] = React.useState("");
  const [assignee, setAssignee] = React.useState("");

  return (
    <div className="space-y-3">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          void mutations.addTask
            .mutateAsync({ title: title.trim(), assignee: assignee || null })
            .then(() => {
              setTitle("");
              setAssignee("");
            })
            .catch((err) => toast(err instanceof Error ? err.message : "Couldn’t add that task."));
        }}
      >
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" />
        <select
          className="h-9 rounded-input border border-line bg-bg-2 px-2 text-sm"
          value={assignee}
          onChange={(event) => setAssignee(event.target.value)}
        >
          <option value="">Unassigned</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={!title.trim()}>
          Add task
        </Button>
      </form>
      {tasks.length === 0 ? (
        <p className="text-sm text-text-lo">No tasks in this Session yet. They also show up on Tasks and Today.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              overdue={Boolean(task.due_date && task.status !== "done" && task.due_date < new Date().toISOString().slice(0, 10))}
              assigneeLabel={members.find((member) => member.user_id === task.assigned_to_user_id)?.display_name}
              onToggle={async () => {
                await taskMutations.update.mutateAsync({
                  id: task.id,
                  patch: { status: task.status === "done" ? "todo" : "done" },
                });
              }}
              onDelete={async () => {
                await taskMutations.remove.mutateAsync(task.id);
              }}
              onOpen={() => {
                window.location.href = `/tasks?task=${task.id}`;
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
