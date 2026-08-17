import type { Metadata } from "next";
import { FlareLine } from "@/components/flare-line";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = {
  title: "Track review — TEMPO",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function ReviewLandingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <Wordmark size={28} className="justify-center" />
        <FlareLine className="mx-auto mt-3 max-w-[100px]" />
        <p className="mt-6 text-sm text-text-lo">
          You need a review link from the track’s owner to open a bounce here.
        </p>
      </div>
    </div>
  );
}
