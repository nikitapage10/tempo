"use client";

import { useParams } from "next/navigation";
import { Ban, Flag, MessageSquareOff, Pin, PinOff, Shuffle, UserCheck, UserX } from "lucide-react";
import { useScene } from "@/hooks/use-scenes";
import { useSceneModerationLog } from "@/hooks/use-scene-moderation";
import { EmptyShaderPanel } from "@/components/shader-empty";
import type { SceneModerationAction } from "@/lib/types";

const ACTION_COPY: Record<SceneModerationAction, { label: string; icon: typeof Pin }> = {
  pin: { label: "Pinned a post", icon: Pin },
  unpin: { label: "Unpinned a post", icon: PinOff },
  remove_post: { label: "Removed a post", icon: MessageSquareOff },
  restore_post: { label: "Restored a post", icon: MessageSquareOff },
  mute: { label: "Muted a member", icon: MessageSquareOff },
  unmute: { label: "Unmuted a member", icon: MessageSquareOff },
  ban: { label: "Banned a member", icon: Ban },
  unban: { label: "Unbanned a member", icon: UserCheck },
  approve: { label: "Approved a join request", icon: UserCheck },
  reject: { label: "Declined a join request", icon: UserX },
  role_change: { label: "Changed a member's role", icon: Shuffle },
  escalate: { label: "Escalated to TEMPO Support", icon: Flag },
};

export default function SceneManageModerationPage() {
  const params = useParams<{ slug: string }>();
  const { data: scene } = useScene(params.slug);
  const { data: log = [], isLoading } = useSceneModerationLog(scene?.id ?? null, true);

  if (!scene) return null;

  if (isLoading) {
    return <div className="panel-quiet h-40 animate-pulse" />;
  }

  if (log.length === 0) {
    return (
      <EmptyShaderPanel
        title="Nothing to review"
        copy="Pins, removals, bans, and role changes you make in this scene show up here."
      />
    );
  }

  return (
    <div className="space-y-1.5">
      {log.map((entry) => {
        const copy = ACTION_COPY[entry.action];
        const Icon = copy?.icon ?? Flag;
        return (
          <div key={entry.id} className="well flex items-center gap-3 rounded-input px-3 py-2.5">
            <Icon className="size-4 shrink-0 text-text-lo" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-hi">{copy?.label ?? entry.action}</p>
              {entry.note ? (
                <p className="truncate text-xs text-text-lo">{entry.note}</p>
              ) : null}
            </div>
            <p className="shrink-0 text-xs text-text-lo">
              {new Date(entry.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        );
      })}
    </div>
  );
}
