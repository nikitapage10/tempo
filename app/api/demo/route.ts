import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findDemoArtist, removeDemo, seedPresidentDemo } from "@/lib/demo/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function noStore() {
  return { "Cache-Control": "no-store" };
}

/** GET — does this account have a demo workspace, and which artist is it? */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: noStore() });
  }

  const demo = await findDemoArtist(supabase);
  return NextResponse.json({ demo }, { headers: noStore() });
}

/** POST — build the demo workspace. Idempotent: a second call is a no-op. */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: noStore() });
  }

  try {
    const result = await seedPresidentDemo(supabase);
    return NextResponse.json(result, { headers: noStore() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't build the demo.";
    console.error("[demo] seed failed:", message);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: noStore() }
    );
  }
}

/**
 * DELETE — remove the demo and everything in it.
 *
 * The member's own artist, its catalog, its Origin draft and its profile were
 * never part of the demo, so there is nothing to restore: they are still there.
 * If their Origin was unfinished when they started exploring, the workspace
 * gate picks it up again on the next load.
 */
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: noStore() });
  }

  const demo = await findDemoArtist(supabase);
  if (!demo) {
    return NextResponse.json({ removed: false }, { headers: noStore() });
  }

  // An explicit id in the body must match what's actually marked as demo data.
  const body = await req.json().catch(() => null);
  const requested = typeof body?.artistId === "string" ? body.artistId : null;
  if (requested && requested !== demo.artistId) {
    return NextResponse.json(
      { error: "That artist isn't demo data." },
      { status: 400, headers: noStore() }
    );
  }

  try {
    await removeDemo(supabase, demo.artistId);
    return NextResponse.json({ removed: true }, { headers: noStore() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't remove the demo.";
    console.error("[demo] remove failed:", message);
    return NextResponse.json({ error: message }, { status: 500, headers: noStore() });
  }
}
