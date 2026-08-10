/**
 * Hand-maintained, not derived from reading /migrations at runtime — the
 * migrations directory isn't guaranteed to ship in the deployed serverless
 * bundle (nothing imports .sql files), so filesystem inspection would work
 * locally and silently fail in production. Bump this whenever a new
 * migration file is added, the same way APP_VERSION gets bumped per change.
 */
export const EXPECTED_LATEST_MIGRATION = 68;
