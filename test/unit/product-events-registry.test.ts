import { describe, expect, it } from "vitest";
import { validateEvent } from "../../lib/product-events/registry";

describe("validateEvent", () => {
  it("accepts a known event with allowed properties", () => {
    const result = validateEvent("first_track_created", { creation_path: "manual" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.properties).toEqual({ creation_path: "manual" });
      expect(result.version).toBe(1);
    }
  });

  it("rejects an unknown event name", () => {
    const result = validateEvent("totally_made_up_event", {});
    expect(result).toEqual({ ok: false, reason: "rejected_event_name" });
  });

  it("strips unknown property keys rather than rejecting the event", () => {
    const result = validateEvent("first_track_created", {
      creation_path: "import",
      track_title: "My Secret Song", // must never survive
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.properties).toEqual({ creation_path: "import" });
      expect(result.properties.track_title).toBeUndefined();
    }
  });

  it("accepts a normal allowlisted array value", () => {
    const result = validateEvent("import_started", { input_modes: ["text"] });
    expect(result.ok).toBe(true);
  });

  it("silently drops an individual value that looks like free text rather than a bucket", () => {
    const huge = "x".repeat(3000);
    const result = validateEvent("import_started", { input_modes: huge, is_first_run: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.properties.input_modes).toBeUndefined();
      expect(result.properties.is_first_run).toBe(true);
    }
  });

  it("rejects the event outright if the total properties payload is still oversized", () => {
    const manyFlags = { input_modes: Array.from({ length: 200 }, (_, i) => `mode-${i}`) };
    const result = validateEvent("import_started", manyFlags);
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object properties payload", () => {
    const result = validateEvent("first_track_created", "not an object");
    expect(result).toEqual({ ok: false, reason: "rejected_shape" });
  });

  it("accepts events with no properties at all", () => {
    const result = validateEvent("focus_session_started", undefined);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.properties).toEqual({});
  });
});
