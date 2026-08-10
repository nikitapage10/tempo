/**
 * Hard refusal to run automated tests against TEMPO's production Supabase
 * project. Every test entrypoint (Vitest setup, Playwright global setup, and
 * any standalone script that touches Supabase) must call
 * `assertSafeTestSupabaseEnv()` before doing anything else.
 *
 * The production project ref is intentionally hardcoded here rather than
 * read from a "which one is production" env var — an env var can be
 * misconfigured or absent, but a literal string in source can only be wrong
 * if someone edits this file, which is a much higher bar.
 */

const PRODUCTION_PROJECT_REF = "bbzzaboqhvqpeoxbyiun";
const EXPECTED_TEST_PROJECT_REF = "aatspyspkpsiyesgutdx";

function projectRefFromUrl(url: string): string | null {
  const match = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

export function assertSafeTestSupabaseEnv(explicitUrl?: string): void {
  const url = explicitUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error(
      "Refusing to run tests: NEXT_PUBLIC_SUPABASE_URL is not set. " +
        "Tests must load .env.test.local (the isolated test project), never .env.local."
    );
  }

  const ref = projectRefFromUrl(url);

  if (!ref) {
    throw new Error(
      `Refusing to run tests: NEXT_PUBLIC_SUPABASE_URL ("${url}") is not a recognizable Supabase project URL.`
    );
  }

  if (ref === PRODUCTION_PROJECT_REF) {
    throw new Error(
      "Refusing to run tests: NEXT_PUBLIC_SUPABASE_URL points at TEMPO's PRODUCTION Supabase project. " +
        "Automated tests must never run against production. Check which .env file was loaded."
    );
  }

  if (ref !== EXPECTED_TEST_PROJECT_REF) {
    throw new Error(
      `Refusing to run tests: NEXT_PUBLIC_SUPABASE_URL points at an unrecognized project ("${ref}"), ` +
        `not the known test project ("${EXPECTED_TEST_PROJECT_REF}"). ` +
        "If you intentionally rotated the test project, update EXPECTED_TEST_PROJECT_REF in " +
        "test/support/test-env-guard.ts."
    );
  }
}
