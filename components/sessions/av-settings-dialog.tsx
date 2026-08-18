"use client";

import * as React from "react";
import type { LocalTrack, Room } from "livekit-client";
import { Camera, Mic, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useMicLevel } from "@/hooks/use-mic-level";
import type { useSessionDevices } from "@/hooks/use-session-devices";
import { deviceLabel, type AvKind } from "@/lib/sessions/av-devices";
import { cn } from "@/lib/utils";

type Devices = ReturnType<typeof useSessionDevices>;

function DevicePicker({
  kind,
  icon,
  label,
  hint,
  devices,
  value,
  onChange,
}: {
  kind: AvKind;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  devices: MediaDeviceInfo[];
  value: string | null;
  onChange: (deviceId: string | null) => void;
}) {
  const id = `av-${kind}`;
  return (
    <div>
      <Label htmlFor={id} className="flex items-center gap-2">
        <span className="text-ice">{icon}</span>
        {label}
      </Label>
      <select
        id={id}
        className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm text-text-hi"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">System default</option>
        {devices.map((device, index) => (
          <option key={device.deviceId} value={device.deviceId}>
            {deviceLabel(device, kind, index)}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1 text-xs text-text-lo">{hint}</p> : null}
    </div>
  );
}

function LevelMeter({ level }: { level: number }) {
  const bars = 18;
  const lit = Math.round(level * bars);
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-4 flex-1 items-end gap-[3px]">
        {Array.from({ length: bars }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "flex-1 rounded-[1px] transition-[height,background-color] duration-100",
              index < lit ? (index > bars - 4 ? "bg-warn" : index > bars - 8 ? "bg-amber" : "bg-ice") : "bg-line"
            )}
            style={{ height: `${30 + (index / bars) * 70}%` }}
          />
        ))}
      </span>
      <span className="w-10 shrink-0 text-right font-data text-[11px] text-text-lo">
        {Math.round(level * 100)}
      </span>
    </div>
  );
}

/**
 * Microphone, camera, and speaker for calls. Opens from the console bar in a
 * Session, on the web and in the desktop shell alike. While the dialog is open
 * it holds its own microphone stream so the meter moves before you have joined
 * anything.
 */
export function AvSettingsDialog({
  open,
  onOpenChange,
  devices,
  room,
  liveMicTrack,
  liveCamera,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devices: Devices;
  room: Room;
  /** The published mic track when already on the call. */
  liveMicTrack?: LocalTrack | null;
  /** The camera is already publishing, so don't open a second stream for preview. */
  liveCamera?: boolean;
}) {
  const [probe, setProbe] = React.useState<MediaStream | null>(null);
  const [probeError, setProbeError] = React.useState<string | null>(null);
  const previewRef = React.useRef<HTMLVideoElement>(null);
  const { selection, select, refresh, canChooseOutput } = devices;
  const liveMediaTrack = (liveMicTrack as { mediaStreamTrack?: MediaStreamTrack } | null | undefined)?.mediaStreamTrack ?? null;
  const probeTrack = probe?.getAudioTracks()[0] ?? null;
  const level = useMicLevel(liveMediaTrack ?? probeTrack, open);

  // Open the mic ourselves only when the call is not already holding it.
  React.useEffect(() => {
    if (!open || liveMediaTrack) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    setProbeError(null);
    navigator.mediaDevices
      ?.getUserMedia({
        audio: selection.audioinput ? { deviceId: { exact: selection.audioinput } } : true,
      })
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        setProbe(next);
        void refresh();
      })
      .catch(() => {
        if (!cancelled) setProbeError("TEMPO could not open that microphone. Check the app's permission.");
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      setProbe(null);
    };
  }, [liveMediaTrack, open, refresh, selection.audioinput]);

  // Camera preview, so picking a camera shows what it sees. Skipped while the
  // call already holds the camera, rather than opening the device twice.
  React.useEffect(() => {
    if (!open || liveCamera) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({
        video: selection.videoinput ? { deviceId: { exact: selection.videoinput } } : true,
      })
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        if (previewRef.current) previewRef.current.srcObject = next;
      })
      .catch(() => {
        /* no camera, or permission refused: the picker still works */
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [liveCamera, open, selection.videoinput]);

  async function testSpeaker() {
    try {
      await room.startAudio();
    } catch {
      /* nothing subscribed yet */
    }
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 440;
    gain.gain.value = 0.0001;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    // Short fade in and out, so the test tone is friendly rather than a beep.
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.7);
    window.setTimeout(() => {
      oscillator.stop();
      void context.close().catch(() => {});
    }, 800);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Sound and camera"
        description="Pick what TEMPO uses for calls. Your choice is remembered on this machine."
        onClose={() => onOpenChange(false)}
      >
        <div className="space-y-4">
          <div>
            <DevicePicker
              kind="audioinput"
              icon={<Mic className="size-3.5" />}
              label="Microphone"
              devices={devices.devices.audioinput}
              value={selection.audioinput}
              onChange={(id) => void select("audioinput", id)}
            />
            <div className="mt-2">
              <LevelMeter level={level} />
              <p className="mt-1 text-xs text-text-lo">
                {probeError ?? "Say something. The bars should move."}
              </p>
            </div>
          </div>

          <DevicePicker
            kind="videoinput"
            icon={<Camera className="size-3.5" />}
            label="Camera"
            devices={devices.devices.videoinput}
            value={selection.videoinput}
            onChange={(id) => void select("videoinput", id)}
          />
          <div className="well flex aspect-video w-full items-center justify-center overflow-hidden">
            {liveCamera ? (
              <p className="px-6 text-center text-xs text-text-lo">
                Your camera is live on the call, so the preview stays off. Switch cameras here and the
                call follows.
              </p>
            ) : (
              <video ref={previewRef} className="size-full object-cover" autoPlay playsInline muted />
            )}
          </div>

          {canChooseOutput ? (
            <div>
              <DevicePicker
                kind="audiooutput"
                icon={<Volume2 className="size-3.5" />}
                label="Speakers"
                devices={devices.devices.audiooutput}
                value={selection.audiooutput}
                onChange={(id) => void select("audiooutput", id)}
              />
              <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => void testSpeaker()}>
                Play a test tone
              </Button>
            </div>
          ) : (
            <p className="text-xs text-text-lo">
              This browser sends call sound wherever your system points it. Change that in your
              computer sound settings.
            </p>
          )}

          <div className="flex justify-end">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
