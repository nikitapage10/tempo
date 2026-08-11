import { describe, expect, it } from "vitest";
import { incomingAlertKind } from "@/lib/notifications/incoming-alerts";

describe("incoming alert sounds", () => {
  it("uses the message chime for direct and support conversations", () => {
    expect(incomingAlertKind("dm_message")).toBe("message");
    expect(incomingAlertKind("support_reply")).toBe("message");
    expect(incomingAlertKind("support_member_reply")).toBe("message");
    expect(incomingAlertKind("support_new")).toBe("message");
  });

  it("uses the notification chime for every other alert", () => {
    expect(incomingAlertKind("comment_reply")).toBe("notification");
    expect(incomingAlertKind("calendar_reminder")).toBe("notification");
    expect(incomingAlertKind(undefined)).toBe("notification");
  });
});
