import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

/**
 * Gives a long-running desktop renderer a stable fingerprint for the current
 * web deployment. Vercel supplies the commit SHA; local/non-Vercel builds fall
 * back to TEMPO's product version so development keeps working normally.
 */
export async function GET() {
  return NextResponse.json(
    {
      buildId: process.env.VERCEL_GIT_COMMIT_SHA || APP_VERSION,
      version: APP_VERSION,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
