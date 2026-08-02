import { NextResponse } from "next/server";
import {
  IMPORT_UNAVAILABLE_MESSAGE,
  noStoreHeaders,
  resolveImport,
} from "@/lib/import-server";
import { askFollowups } from "@/lib/ai/ask-followups";
import { parseSpotifyArtistId } from "@/lib/platforms/spotify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/import/[id]/ask — what should TEMPO ask about next?
 *
 * Drives the back-and-forth on the intake screen. Never fails loudly: if this
 * can't answer, the artist simply doesn't get a follow-up question, and the
 * import carries on exactly as before.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await resolveImport(params.id);
  if (!ctx) {
    return NextResponse.json(
      { error: IMPORT_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() },
    );
  }

  const { data: sources } = await ctx.admin
    .from("onboarding_sources")
    .select("kind, label, extracted_text")
    .eq("import_id", ctx.imp.id)
    .eq("status", "ready")
    .order("sort");

  const usable = (sources ?? []).filter((s) => (s.extracted_text ?? "").trim().length > 0);

  if (usable.length === 0) {
    return NextResponse.json(
      { observation: "", questions: [], enoughToProceed: false },
      { headers: noStoreHeaders() },
    );
  }

  const hasSpotifyArtist = usable.some((source) =>
    Boolean(parseSpotifyArtistId(String(source.extracted_text ?? "")))
  );
  if (hasSpotifyArtist) {
    const spotifyConfigured = Boolean(
      process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
    );
    return NextResponse.json(
      {
        observation: spotifyConfigured
          ? "I found the Spotify artist profile. TEMPO can read its released catalog directly, so you don't need to paste a track list."
          : "I found the Spotify artist profile, but this TEMPO server still needs its Spotify client ID and secret configured before it can read the catalog.",
        questions: [],
        enoughToProceed: spotifyConfigured,
      },
      { headers: noStoreHeaders() }
    );
  }

  try {
    const result = await askFollowups(
      usable.map((s) => ({
        kind: s.kind,
        label: s.label,
        text: s.extracted_text as string,
      })),
    );
    return NextResponse.json(result, { headers: noStoreHeaders() });
  } catch (err) {
    console.error("[import] follow-up questions failed:", err);
    return NextResponse.json(
      { observation: "", questions: [], enoughToProceed: true },
      { headers: noStoreHeaders() },
    );
  }
}
