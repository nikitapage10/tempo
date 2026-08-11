import { describe, expect, it } from "vitest";
import {
  DIRECT_MESSAGE_SIGNAL_TYPE,
  isDirectMessageSignal,
} from "@/lib/notifications/visibility";

describe("direct-message notification visibility", () => {
  it("classifies direct messages as inbox-only signals", () => {
    expect(isDirectMessageSignal(DIRECT_MESSAGE_SIGNAL_TYPE)).toBe(true);
  });

  it("keeps real notification types in the general notification center", () => {
    expect(isDirectMessageSignal("support_reply")).toBe(false);
    expect(isDirectMessageSignal("comment_reply")).toBe(false);
    expect(isDirectMessageSignal(undefined)).toBe(false);
  });
});
