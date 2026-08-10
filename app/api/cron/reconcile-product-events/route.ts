import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const cronHeader = req.headers.get("x-vercel-cron-auth");
  if (cronHeader && cronHeader === secret) return true;
  return false;
}

const FIRST_TRACK_DEDUPE_KEY = "first_track_created:v1";

/**
 * GET/POST /api/cron/reconcile-product-events — daily authoritative
 * milestone reconciliation (02-TECHNICAL-AND-DATA-DESIGN.md §4.3). Client
 * telemetry is best-effort; this job is the backstop that guarantees the
 * `first_track_created` milestone exists for every account that
 * authoritatively has a track, even if the client-side event was lost
 * (ad blocker, closed tab mid-request, etc). It never fabricates UI-view
 * events — only facts derivable from real tables.
 */
async function run(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: firstTracks, error: tracksError } = await admin
    .from("tracks")
    .select("user_id, space_id, created_at")
    .order("created_at", { ascending: true });
  if (tracksError) {
    return NextResponse.json({ error: "Could not read tracks." }, { status: 500 });
  }

  const firstTrackByUser = new Map<string, { spaceId: string | null; createdAt: string }>();
  for (const row of firstTracks ?? []) {
    if (!firstTrackByUser.has(row.user_id)) {
      firstTrackByUser.set(row.user_id, { spaceId: row.space_id, createdAt: row.created_at });
    }
  }

  const { data: existing, error: existingError } = await admin
    .from("product_events")
    .select("user_id")
    .eq("dedupe_key", FIRST_TRACK_DEDUPE_KEY);
  if (existingError) {
    return NextResponse.json({ error: "Could not read product_events." }, { status: 500 });
  }
  const alreadyRecorded = new Set((existing ?? []).map((r) => r.user_id));

  let inserted = 0;
  const errors: string[] = [];
  for (const [userId, fact] of Array.from(firstTrackByUser.entries())) {
    if (alreadyRecorded.has(userId)) continue;
    const { error } = await admin.from("product_events").insert({
      user_id: userId,
      space_id: fact.spaceId,
      event_name: "first_track_created",
      event_version: 1,
      occurred_at: fact.createdAt,
      source_surface: "reconciliation",
      properties: { creation_path: "manual" },
      dedupe_key: FIRST_TRACK_DEDUPE_KEY,
    });
    if (error) {
      if (error.code !== "23505") errors.push(`${userId}: ${error.message}`);
    } else {
      inserted += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    usersWithTracks: firstTrackByUser.size,
    alreadyRecorded: alreadyRecorded.size,
    inserted,
    errors: errors.slice(0, 20),
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
