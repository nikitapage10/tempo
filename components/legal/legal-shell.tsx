import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-0 px-6 py-12 text-text-hi sm:px-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-block">
          <Wordmark size={28} />
        </Link>
        <h1 className="mt-10 font-display text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-sm text-text-lo">Last updated {updated}</p>
        <div className="flare-line mt-6 opacity-50" />
        <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-text-lo [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-text-hi [&_strong]:text-text-hi [&_a]:text-ice [&_a]:hover:underline [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>
        <p className="mt-12 text-xs text-text-lo">
          <Link href="/" className="text-ice hover:underline">
            Back to TEMPO
          </Link>
          {" · "}
          <Link href="/terms" className="text-ice hover:underline">
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="text-ice hover:underline">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
