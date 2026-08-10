import { describe, expect, it, afterEach } from "vitest";
import { assertSafeTestSupabaseEnv } from "../support/test-env-guard";

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
});

describe("assertSafeTestSupabaseEnv", () => {
  it("passes when pointed at the known test project", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://aatspyspkpsiyesgutdx.supabase.co";
    expect(() => assertSafeTestSupabaseEnv()).not.toThrow();
  });

  it("refuses to run when pointed at the production project", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://bbzzaboqhvqpeoxbyiun.supabase.co";
    expect(() => assertSafeTestSupabaseEnv()).toThrow(/PRODUCTION/);
  });

  it("refuses to run when no Supabase URL is configured", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => assertSafeTestSupabaseEnv()).toThrow(/not set/);
  });

  it("refuses to run when pointed at an unrecognized project", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://someoneelseproject.supabase.co";
    expect(() => assertSafeTestSupabaseEnv()).toThrow(/unrecognized project/);
  });
});
