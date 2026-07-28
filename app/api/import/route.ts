import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentUserId, noStoreHeaders } from "@/lib/import-server";
import { isOpenAIConfigured } from "@/lib/ai/openai";

export const dynamic = "force-dynamic";

/**
 * POST /api/import — start a new import session.
 *
 * Nothing is written to the artist's catalog here or by any route below;
 * an import stays a proposal until /commit runs.
 */
export async function POST() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in first." },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "TEMPO's AI connection isn't set up yet." },
      { status: 503, headers: noStoreHeaders() },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("onboarding_imports")
    .insert({ user_id: userId, status: "draft" })
    .select("id, status, created_at")
    .single();

  if (error || !data) {
    console.error("[import] could not create import:", error?.message);
    return NextResponse.json(
      { error: "Couldn’t start an import just now." },
      { status: 500, headers: noStoreHeaders() },
    );
  }

  return NextResponse.json({ import: data }, { headers: noStoreHeaders() });
}
