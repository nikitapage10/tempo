import { NextResponse, type NextRequest } from "next/server";
import {
  IMPORT_UNAVAILABLE_MESSAGE,
  loadWorkspaceContext,
  noStoreHeaders,
  resolveImport,
  setImportStatus,
  synthesizeBurstExceeded,
} from "@/lib/import-server";
import { synthesizePlan } from "@/lib/ai/synthesize-plan";
import { friendlyAIError } from "@/lib/ai/openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/import/[id]/synthesize — draft the proposed workspace.
 *
 * One model call over everything that was extracted, plus the artist's existing
 * catalog so it slots into what they already have. Optionally takes answers to
 * clarifying questions, which is how "re-synthesise after answering" works.
 *
 * Body: { answers?: [{ question, answer }] }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveImport(params.id);
  if (!ctx) {
    return NextResponse.json(
      { error: IMPORT_UNAVAILABLE_MESSAGE },
      { status: 404, headers: noStoreHeaders() },
    );
  }

  if (ctx.imp.committed_at) {
    return NextResponse.json(
      { error: "That import is already built." },
      { status: 409, headers: noStoreHeaders() },
    );
  }

  if (await synthesizeBurstExceeded(ctx.admin, ctx.userId)) {
    return NextResponse.json(
      { error: "That's a lot of imports in one hour. Try again a little later." },
      { status: 429, headers: noStoreHeaders() },
    );
  }

  const payload = await req.json().catch(() => null);
  const answers = Array.isArray(payload?.answers)
    ? payload.answers
        .filter(
          (a: unknown): a is { question: string; answer: string } =>
            Boolean(a) &&
            typeof (a as { question?: unknown }).question === "string" &&
            typeof (a as { answer?: unknown }).answer === "string",
        )
        .slice(0, 10)
    : [];

  const { data: sources } = await ctx.admin
    .from("onboarding_sources")
    .select("id, kind, label, extracted_text")
    .eq("import_id", ctx.imp.id)
    .eq("status", "ready")
    .order("sort");

  const usable = (sources ?? []).filter((s) => (s.extracted_text ?? "").trim().length > 0);

  if (usable.length === 0) {
    return NextResponse.json(
      { error: "There's nothing readable to work from yet. Add something first." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  await setImportStatus(ctx.admin, ctx.imp.id, "synthesizing", { error: null });

  try {
    const context = await loadWorkspaceContext(ctx.admin, ctx.userId);

    const result = await synthesizePlan({
      sources: usable.map((s) => ({
        id: s.id,
        kind: s.kind,
        label: s.label,
        text: s.extracted_text as string,
      })),
      ...context,
      answers,
      today: new Date().toISOString().slice(0, 10),
    });

    await setImportStatus(ctx.admin, ctx.imp.id, "needs_review", {
      plan: result.plan,
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
    });

    return NextResponse.json({ plan: result.plan }, { headers: noStoreHeaders() });
  } catch (err) {
    const message = friendlyAIError(err);
    await setImportStatus(ctx.admin, ctx.imp.id, "failed", { error: message });
    return NextResponse.json(
      { error: message },
      { status: 502, headers: noStoreHeaders() },
    );
  }
}
