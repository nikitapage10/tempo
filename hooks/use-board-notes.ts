"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBoardNote,
  deleteBoardNote,
  fetchBoardNotes,
  moveBoardNoteStage,
  updateBoardNote,
} from "@/lib/api/board-notes";
import type { BoardNote, BoardNoteInsert, BoardNoteUpdate } from "@/lib/types";

export function useBoardNotes(spaceId: string | null) {
  return useQuery({
    queryKey: ["board-notes", spaceId],
    queryFn: () => fetchBoardNotes(spaceId!),
    enabled: !!spaceId,
  });
}

export function useBoardNoteMutations(spaceId: string | null) {
  const qc = useQueryClient();
  const key = ["board-notes", spaceId] as const;

  const create = useMutation({
    mutationFn: (input: Omit<BoardNoteInsert, "space_id">) =>
      createBoardNote({ ...input, space_id: spaceId! }),
    onSuccess: (note) => {
      qc.setQueryData<BoardNote[]>(key, (prev) =>
        prev ? [...prev, note] : [note]
      );
    },
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: BoardNoteUpdate }) =>
      updateBoardNote(id, patch),
    onSuccess: (note) => {
      qc.setQueryData<BoardNote[]>(key, (prev) =>
        prev ? prev.map((n) => (n.id === note.id ? note : n)) : [note]
      );
    },
  });

  const moveStage = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      moveBoardNoteStage(id, stageId),
    onMutate: async ({ id, stageId }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BoardNote[]>(key);
      qc.setQueryData<BoardNote[]>(key, (list) =>
        list
          ? list.map((n) =>
              n.id === id
                ? { ...n, stage_id: stageId, updated_at: new Date().toISOString() }
                : n
            )
          : list
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBoardNote(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<BoardNote[]>(key, (prev) =>
        prev ? prev.filter((n) => n.id !== id) : []
      );
    },
  });

  return { create, update, moveStage, remove };
}
