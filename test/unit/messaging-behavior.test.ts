import { describe, expect, it } from "vitest";
import { isNearConversationBottom, messageDraftStorageKey, preservedScrollTop, resolvePreferredAudioInput, shouldAutoFollowConversation, typingExpiry } from "@/lib/messages/behavior";
import { audioConstraints } from "@/hooks/use-audio-inputs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isMediaRequestAllowed } = require("../../electron/media-permissions.js") as {
  isMediaRequestAllowed: (input: { allowedOrigins: string[]; requestUrl: string; permission: string; mediaTypes?: string[]; mediaType?: string }) => boolean;
};

describe("messaging workspace behavior", () => {
  it("follows only nearby messages or messages sent by the current user", () => {
    expect(shouldAutoFollowConversation({ nearBottom: true, sentByMe: false })).toBe(true);
    expect(shouldAutoFollowConversation({ nearBottom: false, sentByMe: true })).toBe(true);
    expect(shouldAutoFollowConversation({ nearBottom: false, sentByMe: false })).toBe(false);
  });

  it("uses the transcript threshold without moving document scroll", () => {
    expect(isNearConversationBottom({ scrollHeight: 1000, scrollTop: 820, clientHeight: 100 })).toBe(true);
    expect(isNearConversationBottom({ scrollHeight: 1000, scrollTop: 500, clientHeight: 100 })).toBe(false);
    expect(preservedScrollTop({ beforeHeight: 800, beforeTop: 120, afterHeight: 1100 })).toBe(420);
  });

  it("isolates drafts and expires typing activity", () => {
    expect(messageDraftStorageKey("direct:abc")).toBe("tempo:message-draft:direct:abc");
    expect(typingExpiry(1_000)).toBe(6_000);
  });

  it("prefers a chosen microphone and otherwise follows the system default", () => {
    expect(audioConstraints(null)).toMatchObject({ echoCancellation: true, noiseSuppression: true });
    expect(audioConstraints("device-1")).toMatchObject({ deviceId: { exact: "device-1" } });
    expect(resolvePreferredAudioInput("device-1", ["default", "device-1"])).toBe("device-1");
    expect(resolvePreferredAudioInput("stale", ["default", "device-1"])).toBeNull();
  });

  it("allows trusted audio requests while denying cameras and untrusted origins", () => {
    const base = { allowedOrigins: ["https://tempo.example"], requestUrl: "https://tempo.example/messages", permission: "media" };
    expect(isMediaRequestAllowed({ ...base, mediaTypes: ["audio"] })).toBe(true);
    expect(isMediaRequestAllowed({ ...base, mediaTypes: ["video"] })).toBe(false);
    expect(isMediaRequestAllowed({ ...base, mediaTypes: ["audio", "video"] })).toBe(false);
    expect(isMediaRequestAllowed({ ...base, requestUrl: "https://evil.example", mediaTypes: ["audio"] })).toBe(false);
    expect(isMediaRequestAllowed({ ...base, permission: "camera", mediaTypes: ["audio"] })).toBe(false);
  });
});
