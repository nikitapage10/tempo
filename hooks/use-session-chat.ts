"use client";

import { useQuery } from "@tanstack/react-query";
import { resolveSessionConversationId } from "@/lib/api/sessions-rooms";

/** The Session's group conversation id — pass straight into useMessages() /
 *  useMessageMutations() from hooks/use-messages.ts, unchanged. */
export function useSessionConversationId(roomId: string | null) {
  return useQuery({
    queryKey: ["session-conversation", roomId],
    queryFn: () => resolveSessionConversationId(roomId!),
    enabled: !!roomId,
    staleTime: 60_000,
  });
}
