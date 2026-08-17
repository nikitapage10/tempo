"use client";

import { Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CallControls({
  onCall,
  micEnabled,
  cameraEnabled,
  screenEnabled,
  onJoin,
  onLeave,
  onToggleMic,
  onToggleCamera,
  onToggleScreen,
  disabled,
}: {
  onCall: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line bg-bg-1/90 px-4 py-3">
      {onCall ? (
        <>
          <Button type="button" size="sm" variant="secondary" onClick={onToggleMic} disabled={disabled} aria-pressed={micEnabled}>
            {micEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            {micEnabled ? "Mic" : "Muted"}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onToggleCamera} disabled={disabled} aria-pressed={cameraEnabled}>
            {cameraEnabled ? <Video className="size-4" /> : <VideoOff className="size-4" />}
            Camera
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onToggleScreen} disabled={disabled} aria-pressed={screenEnabled}>
            <MonitorUp className="size-4" />
            Share
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={onLeave} disabled={disabled}>
            <PhoneOff className="size-4" />
            Leave
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" onClick={onJoin} disabled={disabled}>
          Join the call
        </Button>
      )}
      <p className={cn("w-full text-center text-[11px] text-text-lo sm:w-auto sm:ml-2")}>
        {onCall ? "You are on the call." : "In the room. Join when you want to talk."}
      </p>
    </div>
  );
}
