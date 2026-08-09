import { type NextRequest, NextResponse } from "next/server";
import { LEGAL_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (body?.accepted !== true || body?.version !== LEGAL_VERSION) {
    return NextResponse.json(
      { error: "Please review and accept the current policies." },
      { status: 400 },
    );
  }

  const acceptedAt = new Date().toISOString();
  const { error } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      legal_terms_version: LEGAL_VERSION,
      legal_terms_accepted_at: acceptedAt,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: "Couldn’t record your acceptance. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, version: LEGAL_VERSION, acceptedAt });
}
