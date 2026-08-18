"use client";

import { Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ToggleButton({
  on,
  label,
  onClick,
  disabled,
  children,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full border transition-colors duration-hover disabled:pointer-events-none disabled:opacity-50",
        on
          ? "border-ice/40 bg-ice/15 text-ice"
          : "border-line bg-bg-2/60 text-text-lo hover:bg-bg-2 hover:text-text-hi"
      )}
    >
      {children}
    </button>
  );
}

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
  className,
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
  className?: string;
}) {
  return (
    <div className={cn("flex justify-center", className)}>
      <div className="glass-chip flex items-center gap-2 px-2 py-2">
        {onCall ? (
          <>
            <ToggleButton on={micEnabled} label={micEnabled ? "Mute" : "Unmute"} onClick={onToggleMic} disabled={disabled}>
              {micEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            </ToggleButton>
            <ToggleButton
              on={cameraEnabled}
              label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
              onClick={onToggleCamera}
              disabled={disabled}
            >
              {cameraEnabled ? <Video className="size-4" /> : <VideoOff className="size-4" />}
            </ToggleButton>
            <ToggleButton
              on={screenEnabled}
              label={screenEnabled ? "Stop sharing" : "Share your screen"}
              onClick={onToggleScreen}
              disabled={disabled}
            >
              <MonitorUp className="size-4" />
            </ToggleButton>
            <span aria-hidden className="mx-0.5 h-6 w-px bg-line" />
            <Button type="button" size="sm" variant="destructive" onClick={onLeave} disabled={disabled} className="rounded-full">
              <PhoneOff className="size-4" />
              Leave
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="sm" onClick={onJoin} disabled={disabled} className="rounded-full px-4">
              Join the call
            </Button>
            <p className="pr-2 text-[11px] text-text-lo">In the room. Join when you want to talk.</p>
          </>
        )}
      </div>
    </div>
  );
}
