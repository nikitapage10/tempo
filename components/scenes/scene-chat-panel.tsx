"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Send } from "lucide-react";
import { useSceneConversationId } from "@/hooks/use-scene-chat";
import { useMyScenePersona, useSceneSections } from "@/hooks/use-scene-v2";
import { useMessageMutations, useMessages } from "@/hooks/use-messages";
import { ArtistMark } from "@/components/artists/artist-mark";
import { EmptyShaderPanel } from "@/components/shader-empty";
import type { SceneMember } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Text-only for now — MessageComposer's file-upload path is built for
 * "direct"/"support" scopes (lib/storage.ts buildMessageMediaPath doesn't
 * have a scene shape), so this stays a lighter composer rather than widening
 * that shared path for a third scope. Sending itself reuses sendMessage/
 * useMessageMutations from the DM stack unchanged — a scene room IS a
 * kind='group' conversation (migration 053).
 */
export function SceneChatPanel({
  sceneId,
  myProfileId,
  myPersonaId = null,
  sectionId = null,
  members,
}: {
  sceneId: string;
  myProfileId: string | null;
  myPersonaId?: string | null;
  sectionId?: string | null;
  members: SceneMember[];
}) {
  const searchParams = useSearchParams();
  const { data: sections = [] } = useSceneSections(sceneId);
  const { data: ownPersona } = useMyScenePersona(sceneId);
  const resolvedSectionId = sectionId ?? sections.find((section) => section.slug === searchParams.get("section") && section.type === "chat")?.id ?? null;
  const resolvedPersonaId = myPersonaId ?? ownPersona?.id ?? null;
  const { data: conversationId, isLoading: resolvingConversation } =
    useSceneConversationId(sceneId, resolvedSectionId);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(
    conversationId ?? null
  );
  const { send } = useMessageMutations(myProfileId, resolvedPersonaId);
  const [text, setText] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  const byProfile = React.useMemo(
    () => new Map(members.map((m) => [m.profile_id, m.profile])),
    [members]
  );
  const byPersona = React.useMemo(
    () => new Map(members.filter((member) => member.persona).map((member) => [member.persona!.id, member.persona!])),
    [members]
  );

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !conversationId) return;
    setText("");
    await send.mutateAsync({ conversationId, body: trimmed });
  }

  if (resolvingConversation) {
    return <div className="panel-quiet h-64 animate-pulse" />;
  }

  if (!conversationId) {
    return (
      <EmptyShaderPanel
        title="Chat is on the way"
        copy="This scene's chat room hasn't been created yet — that finishes with migration 053."
      />
    );
  }

  return (
    <div className="panel flex flex-col overflow-hidden" style={{ height: "32rem" }}>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messagesLoading ? (
          <div className="well h-16 animate-pulse rounded-input" />
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-lo">
            No messages yet — say something.
          </p>
        ) : (
          messages.map((m) => {
            const mine = (resolvedPersonaId && m.sender_scene_persona_id === resolvedPersonaId) || (!!myProfileId && m.sender_profile_id === myProfileId);
            const author = m.sender_profile_id ? byProfile.get(m.sender_profile_id) : undefined;
            const persona = m.sender_scene_persona_id ? byPersona.get(m.sender_scene_persona_id) : null;
            return (
              <div key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
                <ArtistMark
                  emblemUrl={persona?.avatar_url ?? author?.emblem_url ?? null}
                  paletteId={author?.palette_id}
                  iceColor={author?.ice_color}
                  amberColor={author?.amber_color}
                  name={persona?.display_name ?? author?.display_name ?? "Member"}
                  size={24}
                  className="mt-0.5 size-6 shrink-0"
                />
                <div
                  className={cn(
                    "max-w-[75%] rounded-card px-3 py-2 text-sm",
                    mine
                      ? "rounded-br-sm border border-ice/30 bg-ice/10 text-text-hi"
                      : "rounded-tl-sm border border-line bg-bg-2/80 text-text-hi"
                  )}
                >
                  {!mine ? (
                    <p className="mb-0.5 text-[11px] text-text-lo">
                      {persona?.display_name ?? author?.display_name ?? "Member"}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={5000}
          placeholder="Message the scene…"
          className="flex-1 rounded-input border border-line bg-bg-2 px-3 py-2 text-sm text-text-hi placeholder:text-text-lo/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        />
        <button
          type="submit"
          disabled={!text.trim() || send.isPending}
          className="rounded-input p-2 text-ice hover:text-text-hi disabled:text-text-lo disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
