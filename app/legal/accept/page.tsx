import { redirect } from "next/navigation";
import { LegalAcceptanceForm } from "@/components/legal/legal-acceptance-form";
import { Wordmark } from "@/components/wordmark";
import { hasAcceptedCurrentLegalTerms } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | string[] | undefined) {
  const path = Array.isArray(value) ? value[0] : value;
  return path &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/legal/accept")
    ? path
    : "/";
}

export default async function AcceptLegalPage({
  searchParams,
}: {
  searchParams: { next?: string | string[] };
}) {
  const next = safeNext(searchParams.next);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/legal/accept?next=${next}`)}`);
  if (hasAcceptedCurrentLegalTerms(user)) redirect(next);

  return (
    <main className="min-h-screen bg-bg-0 px-6 py-12 text-text-hi sm:px-10">
      <div className="mx-auto max-w-lg">
        <Wordmark size={28} />
        <div className="mt-10">
          <LegalAcceptanceForm next={next} />
        </div>
      </div>
    </main>
  );
}
