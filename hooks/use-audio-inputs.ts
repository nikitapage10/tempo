"use client";

import * as React from "react";
import { resolvePreferredAudioInput } from "@/lib/messages/behavior";

const STORAGE_KEY = "tempo:preferred-microphone:v1";

export function audioConstraints(deviceId: string | null): MediaTrackConstraints | true {
  return deviceId ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true };
}

export function useAudioInputs() {
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceIdState] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput");
    setDevices(inputs);
    setDeviceIdState((current) => {
      const remembered = current ?? localStorage.getItem(STORAGE_KEY);
      const resolved = resolvePreferredAudioInput(remembered, inputs.map((device) => device.deviceId));
      if (resolved) return resolved;
      if (remembered) localStorage.removeItem(STORAGE_KEY);
      return null;
    });
  }, []);

  React.useEffect(() => {
    setDeviceIdState(localStorage.getItem(STORAGE_KEY));
    void refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  const setDeviceId = React.useCallback((next: string | null) => {
    setDeviceIdState(next);
    if (next) localStorage.setItem(STORAGE_KEY, next);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { devices, deviceId, setDeviceId, refresh };
}
