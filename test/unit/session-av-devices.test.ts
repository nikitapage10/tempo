import { describe, expect, it } from "vitest";
import {
  AV_STORAGE_KEY,
  dedupeDevices,
  deviceLabel,
  readAvSelection,
  resolveDevice,
  writeAvSelection,
  type AvStore,
} from "@/lib/sessions/av-devices";

function fakeStore(initial: Record<string, string> = {}): AvStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe("Session A/V device preferences", () => {
  it("returns empty defaults with no store, no value, or junk", () => {
    expect(readAvSelection(null).audioinput).toBeNull();
    expect(readAvSelection(fakeStore()).videoinput).toBeNull();
    expect(readAvSelection(fakeStore({ [AV_STORAGE_KEY]: "not json" })).audiooutput).toBeNull();
  });

  it("round-trips a selection and ignores unknown keys", () => {
    const store = fakeStore();
    writeAvSelection(store, { audioinput: "mic-1", videoinput: null, audiooutput: "spk-2" });
    const stored = JSON.parse(store.data[AV_STORAGE_KEY]) as Record<string, unknown>;
    expect(stored.audioinput).toBe("mic-1");

    store.data[AV_STORAGE_KEY] = JSON.stringify({ audioinput: "mic-1", bogus: "x" });
    expect(readAvSelection(store)).toEqual({ audioinput: "mic-1", videoinput: null, audiooutput: null });
  });

  it("falls back to the system default when the remembered device is gone", () => {
    expect(resolveDevice("mic-1", ["mic-1", "mic-2"])).toBe("mic-1");
    expect(resolveDevice("mic-9", ["mic-1", "mic-2"])).toBeNull();
    expect(resolveDevice(null, ["mic-1"])).toBeNull();
  });

  it("names devices even before permission reveals labels", () => {
    expect(deviceLabel({ deviceId: "x", label: "Scarlett 2i2" }, "audioinput", 0)).toBe("Scarlett 2i2");
    expect(deviceLabel({ deviceId: "default" }, "audiooutput", 3)).toBe("System default");
    expect(deviceLabel({ deviceId: "x" }, "videoinput", 1)).toBe("Camera 2");
  });

  it("collapses the duplicate entries Windows reports for one physical device", () => {
    const list = dedupeDevices([
      { deviceId: "default", groupId: "g1" },
      { deviceId: "a", groupId: "g1" },
      { deviceId: "b", groupId: "g1" },
      { deviceId: "c", groupId: "g2" },
      { deviceId: "", groupId: "g3" },
    ]);
    expect(list.map((row) => row.deviceId)).toEqual(["default", "a", "c"]);
  });
});
