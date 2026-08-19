"use client";

import { Mic, Video } from "lucide-react";
import { CallControls } from "@/components/sessions/call-controls";
import { SessionNoteTaker } from "@/components/sessions/session-note-taker";
import { cn } from "@/lib/utils";

export function CallConsole({
  roomId,
  instanceId,
  speakerLabel,
  notesActive,
  onQuota,
  desktop,
  error,
  onCall,
  micEnabled,
  cameraEnabled,
  screenEnabled,
  micLevel,
  audioBlocked,
  onJoin,
  onLeave,
  onToggleMic,
  onToggleCamera,
  onToggleScreen,
  onOpenSettings,
  onEnableAudio,
  className,
}: {
  roomId: string;
  instanceId: string | null;
  speakerLabel: string;
  notesActive: boolean;
  onQuota: () => void;
  desktop: boolean;
  error: string | null;
  onCall: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  micLevel: number;
  audioBlocked: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onOpenSettings: () => void;
  onEnableAudio: () => void;
  className?: string;
}) {
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 bottom-2 z-20 flex flex-col items-center px-2", className)}>
      <div className="pointer-events-auto">
        <CallControls
          onCall={onCall}
          micEnabled={micEnabled}
          cameraEnabled={cameraEnabled}
          screenEnabled={screenEnabled}
          onJoin={onJoin}
          onLeave={onLeave}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          onToggleScreen={onToggleScreen}
          onOpenSettings={onOpenSettings}
          micLevel={micLevel}
          audioBlocked={audioBlocked}
          onEnableAudio={onEnableAudio}
          disabled={Boolean(error)}
        />
      </div>
      {instanceId ? (
        <SessionNoteTaker
          roomId={roomId}
          instanceId={instanceId}
          speakerLabel={speakerLabel}
          active={notesActive}
          canListen={onCall && micEnabled}
          onQuota={onQuota}
        />
      ) : null}
      {error ? <p className="mt-1 text-center text-xs text-warn">{error}</p> : null}
      {desktop && !onCall ? (
        <p className="mt-1 flex items-center justify-center gap-1 text-center text-[11px] text-text-lo">
          <Mic className="size-3" />
          <Video className="size-3" />
          First join may ask Windows or macOS for permission.
        </p>
      ) : null}
    </div>
  );
}
