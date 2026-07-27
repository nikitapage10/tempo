"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createLink,
  listLinks,
  revokeLink,
  type CreateGuestLinkInput,
} from "@/lib/api/guest-links";
import type { GuestReviewLink } from "@/lib/types";

export function useGuestLinks(trackId: string | null) {
  return useQuery({
    queryKey: ["guest-links", trackId],
    queryFn: () => listLinks(trackId!),
    enabled: !!trackId,
  });
}

export function useGuestLinkMutations(trackId: string | null) {
  const qc = useQueryClient();
  const key = ["guest-links", trackId] as const;

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: (input: Omit<CreateGuestLinkInput, "trackId">) =>
      createLink({ ...input, trackId: trackId! }),
    onSuccess: invalidate,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeLink(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<GuestReviewLink[]>(key);
      if (prev) {
        qc.setQueryData<GuestReviewLink[]>(
          key,
          prev.map((l) =>
            l.id === id ? { ...l, revoked_at: new Date().toISOString() } : l
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  return { create, revoke };
}
