"use client";

import type { EventName } from "./registry";

/**
 * The one call-site product code should use to record telemetry. Fire-and-
 * forget: never throws, never blocks the caller, never surfaces an error to
 * the member. Milestone events should pass a stable `dedupeKey` (e.g.
 * `first_track_created:v1:${trackId}`-shaped only server-side — client code
 * should use a caller-local stable key, never a raw entity ID that could
 * itself leak into properties by mistake).
 */
export function recordProductEvent(
  eventName: EventName,
  properties?: Record<string, unknown>,
  options?: { artistId?: string; spaceId?: string; sourceSurface?: string; dedupeKey?: string }
): void {
  try {
    void fetch("/api/product-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: eventName,
        properties,
        artist_id: options?.artistId,
        space_id: options?.spaceId,
        source_surface: options?.sourceSurface,
        dedupe_key: options?.dedupeKey,
      }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Never let telemetry break the calling flow.
  }
}
