"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addSessionMember,
  checkSessionRoomsSchemaReady,
  createSessionAgendaItem,
  createSessionPin,
  createSessionRoom,
  createSessionTask,
  deleteSessionAgendaItem,
  deleteSessionPin,
  endSessionInstance,
  fetchSessionAgenda,
  fetchSessionAttendance,
  fetchSessionDecisions,
  fetchSessionMeets,
  fetchSessionPins,
  fetchSessionRoom,
  fetchSessionRooms,
  fetchSessionTaskIds,
  leaveSession,
  logSessionDecision,
  removeSessionMember,
  reorderSessionAgenda,
  startSessionInstance,
  updateSessionAgendaItem,
  updateSessionRoom,
  upsertSessionAttendance,
} from "@/lib/api/sessions-rooms";
import { fetchTasks } from "@/lib/api/tasks";

const roomsKey = (artistId: string | null) => ["session-rooms", artistId] as const;
const roomKey = (id: string | null) => ["session-room", id] as const;

export function useSessionRoomsSchemaReady() {
  return useQuery({
    queryKey: ["session-rooms-schema"],
    queryFn: checkSessionRoomsSchemaReady,
    staleTime: 60_000,
  });
}

export function useSessionRooms(artistId: string | null) {
  return useQuery({
    queryKey: roomsKey(artistId),
    queryFn: () => fetchSessionRooms(artistId!),
    enabled: !!artistId,
    staleTime: 15_000,
  });
}

export function useSessionRoom(id: string | null) {
  return useQuery({
    queryKey: roomKey(id),
    queryFn: () => fetchSessionRoom(id!),
    enabled: !!id,
    refetchInterval: 4_000,
  });
}

export function useSessionAgenda(roomId: string | null) {
  return useQuery({
    queryKey: ["session-agenda", roomId],
    queryFn: () => fetchSessionAgenda(roomId!),
    enabled: !!roomId,
  });
}

export function useSessionPins(roomId: string | null) {
  return useQuery({
    queryKey: ["session-pins", roomId],
    queryFn: () => fetchSessionPins(roomId!),
    enabled: !!roomId,
  });
}

export function useSessionRoomTasks(roomId: string | null, spaceId: string | null) {
  return useQuery({
    queryKey: ["session-room-tasks", roomId, spaceId],
    queryFn: async () => {
      const ids = await fetchSessionTaskIds(roomId!);
      if (!ids.length || !spaceId) return [];
      const tasks = await fetchTasks(spaceId);
      const set = new Set(ids);
      return tasks.filter((task) => set.has(task.id));
    },
    enabled: !!roomId && !!spaceId,
  });
}

export function useSessionHistory(roomId: string | null) {
  return useQuery({
    queryKey: ["session-history", roomId],
    queryFn: async () => {
      const meets = await fetchSessionMeets(roomId!);
      const attendance = await fetchSessionAttendance(meets.map((meet) => meet.id));
      const decisions = await fetchSessionDecisions(roomId!);
      return { meets, attendance, decisions };
    },
    enabled: !!roomId,
  });
}

export function useSessionRoomMutations(artistId: string | null, roomId?: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: roomsKey(artistId) });
    if (roomId) void qc.invalidateQueries({ queryKey: roomKey(roomId) });
  };

  return {
    create: useMutation({
      mutationFn: createSessionRoom,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (patch: Parameters<typeof updateSessionRoom>[1]) => updateSessionRoom(roomId!, patch),
      onSuccess: invalidate,
    }),
    addMember: useMutation({
      mutationFn: (input: { userId: string; role?: "host" | "member" }) =>
        addSessionMember(roomId!, input.userId, input.role),
      onSuccess: invalidate,
    }),
    removeMember: useMutation({
      mutationFn: (userId: string) => removeSessionMember(roomId!, userId),
      onSuccess: invalidate,
    }),
    leave: useMutation({
      mutationFn: () => leaveSession(roomId!),
      onSuccess: invalidate,
    }),
    addAgenda: useMutation({
      mutationFn: (body: string) => createSessionAgendaItem(roomId!, body),
      onSuccess: () => void qc.invalidateQueries({ queryKey: ["session-agenda", roomId] }),
    }),
    updateAgenda: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateSessionAgendaItem>[1] }) =>
        updateSessionAgendaItem(id, patch),
      onSuccess: () => void qc.invalidateQueries({ queryKey: ["session-agenda", roomId] }),
    }),
    reorderAgenda: useMutation({
      mutationFn: (ids: string[]) => reorderSessionAgenda(roomId!, ids),
      onSuccess: () => void qc.invalidateQueries({ queryKey: ["session-agenda", roomId] }),
    }),
    deleteAgenda: useMutation({
      mutationFn: deleteSessionAgendaItem,
      onSuccess: () => void qc.invalidateQueries({ queryKey: ["session-agenda", roomId] }),
    }),
    addPin: useMutation({
      mutationFn: (target: Parameters<typeof createSessionPin>[1]) => createSessionPin(roomId!, target),
      onSuccess: () => void qc.invalidateQueries({ queryKey: ["session-pins", roomId] }),
    }),
    deletePin: useMutation({
      mutationFn: deleteSessionPin,
      onSuccess: () => void qc.invalidateQueries({ queryKey: ["session-pins", roomId] }),
    }),
    addTask: useMutation({
      mutationFn: (input: Omit<Parameters<typeof createSessionTask>[0], "roomId">) =>
        createSessionTask({ ...input, roomId: roomId! }),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["session-room-tasks", roomId] });
        void qc.invalidateQueries({ queryKey: ["tasks"] });
      },
    }),
    startInstance: useMutation({
      mutationFn: () => startSessionInstance(roomId!),
      onSuccess: invalidate,
    }),
    endInstance: useMutation({
      mutationFn: (input: { meetId: string; summary?: string }) => endSessionInstance(input.meetId, input.summary),
      onSuccess: () => {
        invalidate();
        void qc.invalidateQueries({ queryKey: ["session-history", roomId] });
        void qc.invalidateQueries({ queryKey: ["session-agenda", roomId] });
      },
    }),
    pingAttendance: useMutation({
      mutationFn: (input: { meetId: string; displayName?: string }) =>
        upsertSessionAttendance(input.meetId, input.displayName),
    }),
    logDecision: useMutation({
      mutationFn: (body: string) => logSessionDecision(roomId!, body),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["session-history", roomId] });
        void qc.invalidateQueries({ queryKey: ["conversation-messages"] });
      },
    }),
  };
}
