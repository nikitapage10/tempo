"use client";

import { useQuery } from "@tanstack/react-query";
import { resolveSceneConversationId } from "@/lib/api/scene-chat";

/** The scene's group conversation id — pass straight into useMessages() /
 *  useMessageMutations() from hooks/use-messages.ts, unchanged. */
export function useSceneConversationId(sceneId: string | null, sectionId?: string | null) {
  return useQuery({
    queryKey: ["scene-conversation", sceneId, sectionId ?? "default"],
    queryFn: () => resolveSceneConversationId(sceneId!, sectionId),
    enabled: !!sceneId,
    staleTime: 60_000,
  });
}
