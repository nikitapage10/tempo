"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, MapPin, Settings2, Users } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { SignedImage } from "@/components/ui/signed-image";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SceneThemeScope } from "@/components/scenes/scene-theme-scope";
import { resolveArtistAccent } from "@/lib/artist-theme";
import type { Scene } from "@/lib/types";

const KIND_LABEL: Record<Scene["kind"], string> = {
  label: "Label",
  school: "School",
  crew: "Crew",
  collective: "Collective",
  genre: "Genre",
  local: "Local",
  other: "Scene",
};

type JoinAction = {
  disabled: boolean;
  label: string;
  onClick?: () => void;
};

export function SceneHeader({
  scene,
  joinPending,
  onJoin,
  onAcceptInvite,
  onLeave,
}: {
  scene: Scene;
  joinPending: boolean;
  onJoin: () => void;
  onAcceptInvite: () => void;
  onLeave: () => void;
}) {
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const { ice, amber } = resolveArtistAccent(scene.palette_id, {
    ice: scene.ice_color,
    amber: scene.amber_color,
  });
  const isManager = scene.my_role === "owner" || scene.my_role === "moderator";

  let action: JoinAction;
  if (scene.my_status === "active") {
    action = { disabled: false, label: "Leave scene", onClick: () => setConfirmLeave(true) };
  } else if (scene.my_status === "pending") {
    action = { disabled: true, label: "Waiting on approval" };
  } else if (scene.my_status === "invited") {
    action = { disabled: joinPending, label: "Accept invite", onClick: onAcceptInvite };
  } else if (scene.my_status === "banned") {
    action = { disabled: true, label: "Not available" };
  } else if (scene.join_policy === "invite") {
    action = { disabled: true, label: "Invite only" };
  } else {
    action = {
      disabled: joinPending,
      label: scene.join_policy === "open" ? "Join" : "Ask to join",
      onClick: onJoin,
    };
  }

  return (
    <SceneThemeScope scene={scene} className="overflow-hidden rounded-panel border border-line shadow-e1">
      <div
        className="relative h-32 sm:h-40"
        style={
          scene.banner_url
            ? undefined
            : {
                background: `linear-gradient(135deg, color-mix(in srgb, ${ice} 32%, transparent), color-mix(in srgb, ${amber} 24%, transparent))`,
              }
        }
      >
        {scene.banner_url ? (
          <SignedImage path={scene.banner_url} alt="" className="size-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-1 via-bg-1/10 to-transparent" />
      </div>

      <div className="bg-bg-1 px-5 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4 -mt-8">
          <div className="flex items-end gap-3">
            <ArtistMark
              emblemUrl={scene.emblem_url}
              paletteId={scene.palette_id}
              iceColor={scene.ice_color}
              amberColor={scene.amber_color}
              name={scene.name}
              size={56}
              className="size-14 border-4 border-bg-1 bg-bg-1"
            />
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-semibold tracking-tight text-text-hi">
                  {scene.name}
                </h1>
                <span className="rounded-chip border border-line px-2 py-0.5 text-[11px] text-text-lo">
                  {KIND_LABEL[scene.kind]}
                </span>
              </div>
              {scene.tagline ? (
                <p className="mt-0.5 text-sm text-text-lo">{scene.tagline}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-lo">
                <span className="flex items-center gap-1">
                  <Users className="size-3" />
                  {scene.member_count} {scene.member_count === 1 ? "member" : "members"}
                </span>
                {scene.location ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {scene.location}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pb-1">
            {isManager ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={`/scenes/${scene.slug}/manage`}>
                  <Settings2 className="size-3.5" />
                  Manage
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant={action.onClick ? "default" : "secondary"}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {joinPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {action.label}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={`Leave ${scene.name}?`}
        description="You'll lose access to its feed, events, and chat until you join again."
        confirmLabel="Leave scene"
        onConfirm={() => {
          setConfirmLeave(false);
          onLeave();
        }}
      />
    </SceneThemeScope>
  );
}
