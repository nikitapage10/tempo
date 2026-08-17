import { describe, expect, it } from "vitest";
import { canExpandDirectConversation, conversationHeading, conversationMemberLabel, isArtistGroupConversation, isMessagesInboxConversation, isNearConversationBottom, isSessionConversation, messageDraftStorageKey, MESSAGES_WORKSPACE_HEIGHT_CLASS, preservedScrollTop, resolvePreferredAudioInput, shouldAutoFollowConversation, suggestedGroupTitle, typingExpiry } from "@/lib/messages/behavior";
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

  it("allows trusted audio and video requests while denying untrusted origins", () => {
    const base = { allowedOrigins: ["https://tempo.example"], requestUrl: "https://tempo.example/messages", permission: "media" };
    expect(isMediaRequestAllowed({ ...base, mediaTypes: ["audio"] })).toBe(true);
    expect(isMediaRequestAllowed({ ...base, mediaTypes: ["video"] })).toBe(true);
    expect(isMediaRequestAllowed({ ...base, mediaTypes: ["audio", "video"] })).toBe(true);
    expect(isMediaRequestAllowed({ ...base, requestUrl: "https://evil.example", mediaTypes: ["audio"] })).toBe(false);
    expect(isMediaRequestAllowed({ ...base, permission: "camera", mediaTypes: ["audio"] })).toBe(false);
  });

  it("keeps Scene rooms out of the Messages inbox while including artist groups", () => {
    expect(isMessagesInboxConversation({ kind: "direct", sceneId: null, isTeamRoom: false })).toBe(true);
    expect(isMessagesInboxConversation({ kind: "group", sceneId: "scene-1", isTeamRoom: false })).toBe(false);
    expect(isMessagesInboxConversation({ kind: "group", sceneId: null, isTeamRoom: true })).toBe(true);
    expect(isMessagesInboxConversation({ kind: "group", sceneId: null, isTeamRoom: false })).toBe(true);
    expect(isArtistGroupConversation({ kind: "group", teamArtistId: null })).toBe(true);
    expect(isArtistGroupConversation({ kind: "group", teamArtistId: "artist-1" })).toBe(false);
    expect(isArtistGroupConversation({ kind: "group", teamArtistId: null, sessionRoomId: "room-1" })).toBe(false);
    expect(isArtistGroupConversation({ kind: "direct", teamArtistId: null })).toBe(false);
    expect(isSessionConversation({ sessionRoomId: "room-1" })).toBe(true);
    expect(isMessagesInboxConversation({ kind: "group", sceneId: null, isTeamRoom: false })).toBe(true);
    expect(conversationHeading({ kind: "group", title: "Late mix", sessionRoomId: "room-1" })).toBe("Late mix");
    expect(suggestedGroupTitle(["Alex", "Jordan", "Sam", "Riley"])).toBe("Alex, Jordan +2");
    expect(conversationHeading({ kind: "group", title: "Studio crew" })).toBe("Studio crew");
    expect(conversationMemberLabel(["Alex", "Jordan", "Sam", "Riley"])).toBe("Alex, Jordan, Sam +1");
    expect(canExpandDirectConversation({ kind: "direct", teamArtistId: null })).toBe(true);
    expect(canExpandDirectConversation({ kind: "direct", teamArtistId: "artist-1" })).toBe(false);
    expect(canExpandDirectConversation({ kind: "group", teamArtistId: null })).toBe(false);
    expect(MESSAGES_WORKSPACE_HEIGHT_CLASS).toContain("--tempo-content-zoom");
    expect(MESSAGES_WORKSPACE_HEIGHT_CLASS).toContain("12.5rem");
  });
});
