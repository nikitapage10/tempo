import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isMediaRequestAllowed } = require("../../electron/media-permissions.js") as {
  isMediaRequestAllowed: (input: {
    allowedOrigins: string[];
    requestUrl: string;
    permission: string;
    mediaTypes?: string[];
    mediaType?: string;
  }) => boolean;
};

describe("Electron media permissions", () => {
  const base = {
    allowedOrigins: ["https://mytempo.dev"],
    requestUrl: "https://mytempo.dev/sessions/abc",
  };

  it("allows microphone, camera, or both from a trusted origin", () => {
    expect(isMediaRequestAllowed({ ...base, permission: "media", mediaTypes: ["audio"] })).toBe(true);
    expect(isMediaRequestAllowed({ ...base, permission: "media", mediaTypes: ["video"] })).toBe(true);
    expect(isMediaRequestAllowed({ ...base, permission: "media", mediaTypes: ["audio", "video"] })).toBe(true);
  });

  it("allows display-capture from a trusted origin", () => {
    expect(isMediaRequestAllowed({ ...base, permission: "display-capture" })).toBe(true);
  });

  it("denies untrusted origins and unrelated permissions", () => {
    expect(
      isMediaRequestAllowed({
        ...base,
        requestUrl: "https://evil.example",
        permission: "media",
        mediaTypes: ["video"],
      })
    ).toBe(false);
    expect(isMediaRequestAllowed({ ...base, permission: "camera", mediaTypes: ["video"] })).toBe(false);
  });
});
