import { NextResponse, type NextRequest } from "next/server";
import {
  listAllUserIds,
  snapshotUserCatalog,
} from "@/lib/catalog-backup/snapshots";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  // Vercel Cron sends this header when CRON_SECRET is configured.
  const cronHeader = req.headers.get("x-vercel-cron-auth");
  if (cronHeader && cronHeader === secret) return true;
  return false;
}

/**
 * GET/POST /api/cron/catalog-snapshots — nightly metadata snapshots for every user.
 * Secured with CRON_SECRET. Configure in vercel.json + Vercel env.
 */
async function run(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const userIds = await listAllUserIds(admin);
    let ok = 0;
    let failed = 0;
    const errors: { userId: string; message: string }[] = [];

    for (const userId of userIds) {
      try {
        await snapshotUserCatalog(admin, userId, "nightly");
        ok += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[cron/catalog-snapshots] ${userId}:`, message);
        if (errors.length < 20) errors.push({ userId, message });
      }
    }

    return NextResponse.json({
      ok: true,
      users: userIds.length,
      snapshotted: ok,
      failed,
      errors,
    });
  } catch (err) {
    console.error("[cron/catalog-snapshots]", err);
    return NextResponse.json({ error: "Snapshot cron failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
