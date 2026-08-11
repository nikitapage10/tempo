"use client";

import * as React from "react";
import { Mic2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioInputs } from "@/hooks/use-audio-inputs";

export function AudioInputPanel() {
  const { devices, deviceId, setDeviceId, refresh } = useAudioInputs();
  const [refreshing, setRefreshing] = React.useState(false);

  async function refreshDevices() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="panel-quiet p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ice/20 bg-ice/10">
          <Mic2 className="size-4 text-ice" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold tracking-tight text-text-hi">
            Microphone
          </p>
          <p className="mt-1 text-sm leading-relaxed text-text-lo">
            Choose the input TEMPO uses for message dictation and voice notes on this device.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Preferred microphone</span>
              <select
                value={deviceId ?? ""}
                onChange={(event) => setDeviceId(event.target.value || null)}
                className="w-full rounded-input border border-line bg-bg-2 px-3 py-2 text-sm text-text-hi focus:outline-none focus:ring-1 focus:ring-ice"
              >
                <option value="">System default</option>
                {devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="secondary" size="sm" disabled={refreshing} onClick={() => void refreshDevices()}>
              <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
              Refresh
            </Button>
          </div>
          {!devices.length ? (
            <p className="mt-2 text-xs text-text-lo">
              No microphone inputs are visible yet. Connect one or allow microphone access, then refresh.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
