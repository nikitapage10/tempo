import { createAdminClient } from "@/lib/supabase/admin";
import { validateEvent } from "./registry";

export type RecordEventInput = {
  userId: string;
  eventName: string;
  properties?: unknown;
  artistId?: string | null;
  spaceId?: string | null;
  sourceSurface?: string | null;
  dedupeKey?: string | null;
  occurredAt?: string;
};

export type RecordEventResult =
  | { status: "accepted" }
  | { status: "rejected"; reason: "rejected_event_name" | "rejected_shape" }
  | { status: "duplicate" };

/**
 * The single server-side insert boundary for product_events — never called
 * from the browser. Validates against the versioned registry, verifies
 * artist/space ownership before allowing that scoping, and logs a minimal,
 * content-free counter row for rejected/duplicate attempts so Admin health
 * can report ingestion rates without ever storing what was rejected.
 */
export async function recordProductEventServer(input: RecordEventInput): Promise<RecordEventResult> {
  const validated = validateEvent(input.eventName, input.properties);
  const admin = createAdminClient();

  if (!validated.ok) {
    await admin.from("product_event_ingestion_errors").insert({
      reason: validated.reason,
      event_name: input.eventName.slice(0, 64),
    });
    return { status: "rejected", reason: validated.reason };
  }

  let artistId: string | null = null;
  if (input.artistId) {
    const { data } = await admin
      .from("artists")
      .select("id")
      .eq("id", input.artistId)
      .eq("user_id", input.userId)
      .maybeSingle();
    artistId = data?.id ?? null; // silently drop scoping if caller doesn't own it
  }

  let spaceId: string | null = null;
  if (input.spaceId) {
    const { data } = await admin
      .from("spaces")
      .select("id, artist_id, artists!inner(user_id)")
      .eq("id", input.spaceId)
      .eq("artists.user_id", input.userId)
      .maybeSingle();
    spaceId = data?.id ?? null;
  }

  const { error } = await admin.from("product_events").insert({
    user_id: input.userId,
    artist_id: artistId,
    space_id: spaceId,
    event_name: validated.eventName,
    event_version: validated.version,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    session_id: null,
    source_surface: input.sourceSurface ?? null,
    properties: validated.properties,
    dedupe_key: input.dedupeKey ?? null,
  });

  if (error) {
    // Unique violation on (user_id, dedupe_key) — the expected, common path
    // for milestone events firing more than once from a flaky client.
    if (error.code === "23505") {
      await admin.from("product_event_ingestion_errors").insert({
        reason: "duplicate",
        event_name: validated.eventName,
      });
      return { status: "duplicate" };
    }
    await admin.from("product_event_ingestion_errors").insert({
      reason: "rejected_shape",
      event_name: validated.eventName,
    });
    return { status: "rejected", reason: "rejected_shape" };
  }

  return { status: "accepted" };
}
