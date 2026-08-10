/**
 * Versioned, content-free product-event contract —
 * 02-TECHNICAL-AND-DATA-DESIGN.md §4.1/§4.2. This is the single source of
 * truth for what may be recorded: event names and their exhaustive allowed
 * property keys. Anything not listed here is rejected or stripped by
 * validateEvent() below — never silently passed through.
 *
 * Property VALUES are intentionally untyped strings/numbers/booleans/arrays
 * here; the real safety property is the KEY allowlist plus the hard rule
 * that no free text, title, filename, URL, ID (other than the top-level
 * artist_id/space_id columns), or name may ever appear in `properties`.
 * Callers are responsible for only ever passing bucketed/enum values —
 * this registry cannot inspect string content for creative text.
 */

export type EventName = keyof typeof EVENT_REGISTRY;

export const EVENT_REGISTRY = {
  account_session_started: { version: 1, properties: ["entry_surface", "days_since_prior_session_bucket"] },
  import_started: { version: 1, properties: ["input_modes", "is_first_run"] },
  import_review_reached: { version: 1, properties: ["item_count_bucket", "needs_attention_bucket"] },
  import_completed: { version: 1, properties: ["track_count_bucket", "project_count_bucket", "task_count_bucket", "duration_bucket"] },
  import_failed: { version: 1, properties: ["failure_class", "phase"] },
  first_track_created: { version: 1, properties: ["creation_path"] },
  workflow_intent_set: { version: 1, properties: ["intent_type", "source_surface"] },
  focus_session_started: { version: 1, properties: ["source_surface", "has_goal", "checklist_count_bucket"] },
  focus_session_completed: { version: 1, properties: ["duration_bucket", "next_move_updated", "bounce_uploaded"] },
  version_upload_started: { version: 1, properties: ["file_type", "size_bucket", "source_surface"] },
  version_upload_completed: { version: 1, properties: ["file_type", "size_bucket", "conversion_used", "duration_bucket"] },
  version_upload_failed: { version: 1, properties: ["failure_class", "phase", "file_type", "size_bucket"] },
  guest_link_created: { version: 1, properties: ["expiry_bucket", "comments_enabled", "download_enabled"] },
  collaborator_invited: { version: 1, properties: ["role", "delivery_mode"] },
  external_feedback_received: { version: 1, properties: ["feedback_type", "author_kind"] },
  feedback_resolved: { version: 1, properties: ["feedback_type", "age_bucket"] },
  release_plan_created: { version: 1, properties: ["task_count_bucket", "source_surface"] },
  activation_guide_viewed: { version: 1, properties: ["recommended_step", "state"] },
  activation_guide_actioned: { version: 1, properties: ["recommended_step"] },
  activation_guide_snoozed: { version: 1, properties: ["recommended_step", "days"] },
  activation_guide_hidden: { version: 1, properties: ["recommended_step"] },
  activation_loop_completed: { version: 1, properties: ["activation_definition_version", "days_since_signup_bucket"] },
  pulse_preferences_updated: { version: 1, properties: ["frequency", "include_entity_names"] },
  pulse_digest_scheduled: { version: 1, properties: ["delivery_kind", "item_count_bucket"] },
  pulse_digest_sent: { version: 1, properties: ["delivery_kind"] },
  pulse_digest_suppressed: { version: 1, properties: ["reason", "delivery_kind"] },
  pulse_digest_failed: { version: 1, properties: ["failure_class", "delivery_kind"] },
  pulse_link_opened: { version: 1, properties: ["delivery_kind", "destination_surface"] },
} as const satisfies Record<string, { version: number; properties: readonly string[] }>;

export type ValidationResult =
  | { ok: true; eventName: EventName; version: number; properties: Record<string, unknown> }
  | { ok: false; reason: "rejected_event_name" | "rejected_shape" };

/**
 * Validates and strips an inbound event. Unknown event names are rejected
 * outright; unknown property keys are silently stripped (not rejected),
 * matching "Unknown names/keys are rejected or stripped" — dropping extras
 * keeps a slightly-stale client from failing closed on every event.
 */
export function validateEvent(eventName: string, rawProperties: unknown): ValidationResult {
  if (!(eventName in EVENT_REGISTRY)) {
    return { ok: false, reason: "rejected_event_name" };
  }
  const def = EVENT_REGISTRY[eventName as EventName];

  if (rawProperties !== undefined && rawProperties !== null && typeof rawProperties !== "object") {
    return { ok: false, reason: "rejected_shape" };
  }
  const input = (rawProperties as Record<string, unknown>) ?? {};

  const properties: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (!(def.properties as readonly string[]).includes(key)) continue; // stripped, not rejected — the
    // per-event allowlist above is the actual authority; there is no additional
    // pattern check on key names, since a fixed allowlist can't have false positives
    // the way a substring pattern can (e.g. "creation_path" containing "path").
    const value = input[key];
    const valueType = typeof value;
    if (value === null) continue;
    if (valueType === "string" && (value as string).length > 200) continue; // never free text
    if (!["string", "number", "boolean"].includes(valueType) && !Array.isArray(value)) continue;
    properties[key] = value;
  }

  if (JSON.stringify(properties).length > 2000) {
    return { ok: false, reason: "rejected_shape" };
  }

  return { ok: true, eventName: eventName as EventName, version: def.version, properties };
}
