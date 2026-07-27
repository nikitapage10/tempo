"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  countUnreadNotifications,
  deleteNotification,
  fetchNotifications,
  markAllRead,
  markRead,
} from "@/lib/api/notifications";
import type { AppNotification } from "@/lib/types";

export function useNotifications(limit = 50) {
  return useQuery({
    queryKey: ["notifications", limit],
    queryFn: () => fetchNotifications(limit),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: countUnreadNotifications,
  });
}

export function useNotificationMutations() {
  const qc = useQueryClient();
  const key = ["notifications"] as const;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  };

  const read = useMutation({
    mutationFn: (id: string) => markRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueriesData<AppNotification[]>({ queryKey: key });
      prev.forEach(([queryKey, data]) => {
        if (!data) return;
        qc.setQueryData<AppNotification[]>(
          queryKey,
          data.map((n) =>
            n.id === id ? { ...n, read_at: new Date().toISOString() } : n
          )
        );
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data));
    },
    onSettled: invalidate,
  });

  const readAll = useMutation({
    mutationFn: () => markAllRead(),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: invalidate,
  });

  return { read, readAll, remove };
}
