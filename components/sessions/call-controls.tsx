"use client";

import * as React from "react";
import { Mic, MicOff, MonitorUp, PhoneOff, Settings2, Video, VideoOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ConsoleButton({
  on,
  danger,
  label,
  onClick,
  disabled,
  children,
}: {
  on?: boolean;
  danger?: boolean;
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
      aria-pressed={danger ? undefined : Boolean(on)}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex size-11 items-center justify-center rounded-full border transition-colors duration-hover disabled:pointer-events-none disabled:opacity-45",
        danger
          ? "border-warn/40 bg-warn/15 text-warn hover:bg-warn/25"
          : on
            ? "border-ice/45 bg-ice/15 text-ice"
            : "border-line bg-bg-2/70 text-text-lo hover:bg-bg-2 hover:text-text-hi"
      )}
    >
      {children}
    </button>
  );
}

/**
 * The console under the stage. Round metal-ish buttons, a live meter wrapped
 * around the microphone so you can see your own voice registering, and the
 * device picker one click away.
 */
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
  onOpenSettings,
  micLevel = 0,
  audioBlocked,
  onEnableAudio,
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
  onOpenSettings?: () => void;
  /** 0..1 from the local microphone, for the ring around the mic button. */
  micLevel?: number;
  audioBlocked?: boolean;
  onEnableAudio?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {audioBlocked && onEnableAudio ? (
        <button
          type="button"
          onClick={onEnableAudio}
          className="inline-flex items-center gap-2 rounded-chip border border-amber/40 bg-amber/12 px-3 py-1 text-xs font-medium text-amber"
        >
          <Volume2 className="size-3.5" />
          Your browser is holding the sound back. Tap to hear the room.
        </button>
      ) : null}

      <div className="glass flex items-center gap-2 rounded-full px-3 py-2">
        {onCall ? (
          <>
            <span className="relative inline-flex">
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-1 rounded-full transition-transform duration-100"
                style={{
                  transform: `scale(${1 + micLevel * 0.22})`,
                  opacity: micEnabled ? 0.25 + micLevel * 0.75 : 0,
                  background:
                    "radial-gradient(circle, color-mix(in srgb, var(--ok) 55%, transparent) 0%, transparent 70%)",
                }}
              />
              <ConsoleButton
                on={micEnabled}
                label={micEnabled ? "Mute your microphone" : "Unmute your microphone"}
                onClick={onToggleMic}
                disabled={disabled}
              >
                {micEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
              </ConsoleButton>
            </span>
            <ConsoleButton
              on={cameraEnabled}
              label={cameraEnabled ? "Turn your camera off" : "Turn your camera on"}
              onClick={onToggleCamera}
              disabled={disabled}
            >
              {cameraEnabled ? <Video className="size-4" /> : <VideoOff className="size-4" />}
            </ConsoleButton>
            <ConsoleButton
              on={screenEnabled}
              label={screenEnabled ? "Stop sharing your screen" : "Share your screen"}
              onClick={onToggleScreen}
              disabled={disabled}
            >
              <MonitorUp className="size-4" />
            </ConsoleButton>
            {onOpenSettings ? (
              <ConsoleButton label="Sound and camera settings" onClick={onOpenSettings}>
                <Settings2 className="size-4" />
              </ConsoleButton>
            ) : null}
            <span aria-hidden className="mx-1 h-7 w-px bg-line" />
            <ConsoleButton danger label="Leave the call" onClick={onLeave} disabled={disabled}>
              <PhoneOff className="size-4" />
            </ConsoleButton>
          </>
        ) : (
          <>
            <Button
              type="button"
              onClick={onJoin}
              disabled={disabled}
              className="h-10 rounded-full px-5 text-sm"
            >
              <Mic className="size-4" />
              Join the call
            </Button>
            {onOpenSettings ? (
              <ConsoleButton label="Sound and camera settings" onClick={onOpenSettings}>
                <Settings2 className="size-4" />
              </ConsoleButton>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
