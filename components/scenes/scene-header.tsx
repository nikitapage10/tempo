"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Settings2 } from "lucide-react";
import { SceneHero } from "@/components/scenes/scene-hero";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Scene } from "@/lib/types";

type JoinAction = { disabled: boolean; label: string; onClick?: () => void };

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
    <>
      <SceneHero
        scene={scene}
        actions={
          <>
            {isManager ? (
              <Button asChild size="sm" variant="secondary" className="border-white/10 bg-black/45 backdrop-blur-md hover:bg-black/65">
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
          </>
        }
      />
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={`Leave ${scene.name}?`}
        description="You'll lose access to its discussions, events, library, and chat until you join again."
        confirmLabel="Leave scene"
        onConfirm={() => {
          setConfirmLeave(false);
          onLeave();
        }}
      />
    </>
  );
}
