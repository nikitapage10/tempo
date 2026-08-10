import { describe, expect, it } from "vitest";
import { hashEmail, hashToken } from "../../lib/pulse/suppression";

describe("hashEmail", () => {
  it("is deterministic and case/whitespace-insensitive", () => {
    expect(hashEmail("Artist@Example.com")).toBe(hashEmail(" artist@example.com "));
  });

  it("produces different hashes for different addresses", () => {
    expect(hashEmail("a@example.com")).not.toBe(hashEmail("b@example.com"));
  });

  it("never returns the plaintext email", () => {
    const hash = hashEmail("secret@example.com");
    expect(hash).not.toContain("secret");
    expect(hash).not.toContain("@");
  });
});

describe("hashToken", () => {
  it("is deterministic", () => {
    expect(hashToken("abc123")).toBe(hashToken("abc123"));
  });

  it("differs for different tokens", () => {
    expect(hashToken("abc123")).not.toBe(hashToken("abc124"));
  });
});
