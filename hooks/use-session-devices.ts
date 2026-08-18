"use client";

import * as React from "react";
import type { Room } from "livekit-client";
import {
  dedupeDevices,
  readAvSelection,
  resolveDevice,
  writeAvSelection,
  type AvKind,
  type AvSelection,
  EMPTY_AV_SELECTION,
} from "@/lib/sessions/av-devices";

export type DeviceLists = Record<AvKind, MediaDeviceInfo[]>;

const EMPTY_LISTS: DeviceLists = { audioinput: [], videoinput: [], audiooutput: [] };

function supportsOutputSwitching(): boolean {
  if (typeof window === "undefined") return false;
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

/**
 * Microphone, camera, and speaker choice for a Session call. The picked
 * devices are remembered per browser and reapplied whenever the room
 * reconnects, so plugging in an interface once is enough.
 */
export function useSessionDevices(room: Room) {
  const [devices, setDevices] = React.useState<DeviceLists>(EMPTY_LISTS);
  const [selection, setSelection] = React.useState<AvSelection>({ ...EMPTY_AV_SELECTION });
  const canChooseOutput = React.useMemo(supportsOutputSwitching, []);

  const refresh = React.useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    let all: MediaDeviceInfo[] = [];
    try {
      all = await navigator.mediaDevices.enumerateDevices();
    } catch {
      return;
    }
    const next: DeviceLists = {
      audioinput: dedupeDevices(all.filter((device) => device.kind === "audioinput")),
      videoinput: dedupeDevices(all.filter((device) => device.kind === "videoinput")),
      audiooutput: dedupeDevices(all.filter((device) => device.kind === "audiooutput")),
    };
    setDevices(next);
    setSelection((current) => ({
      audioinput: resolveDevice(current.audioinput, next.audioinput.map((row) => row.deviceId)),
      videoinput: resolveDevice(current.videoinput, next.videoinput.map((row) => row.deviceId)),
      audiooutput: resolveDevice(current.audiooutput, next.audiooutput.map((row) => row.deviceId)),
    }));
  }, []);

  React.useEffect(() => {
    setSelection(readAvSelection(typeof window === "undefined" ? null : window.localStorage));
    void refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  const apply = React.useCallback(
    async (kind: AvKind, deviceId: string | null) => {
      if (!deviceId) return;
      try {
        await room.switchActiveDevice(kind, deviceId);
      } catch {
        /* the device vanished between listing and switching; system default stands */
      }
    },
    [room]
  );

  /** Reapply the remembered devices, e.g. right after joining the call. */
  const applyAll = React.useCallback(async () => {
    for (const kind of ["audioinput", "videoinput", "audiooutput"] as AvKind[]) {
      if (kind === "audiooutput" && !canChooseOutput) continue;
      await apply(kind, selection[kind]);
    }
  }, [apply, canChooseOutput, selection]);

  const select = React.useCallback(
    async (kind: AvKind, deviceId: string | null) => {
      setSelection((current) => {
        const next = { ...current, [kind]: deviceId };
        writeAvSelection(typeof window === "undefined" ? null : window.localStorage, next);
        return next;
      });
      await apply(kind, deviceId);
      // Labels stay hidden until a permission is granted, so a switch is a
      // good moment to re-read the list.
      void refresh();
    },
    [apply, refresh]
  );

  return { devices, selection, select, applyAll, refresh, canChooseOutput };
}
