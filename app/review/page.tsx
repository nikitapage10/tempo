import type { Metadata } from "next";
import { FlareLine } from "@/components/flare-line";

export const metadata: Metadata = {
  title: "Track review — TEMPO",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function ReviewLandingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <h1 className="font-display text-xl font-semibold text-text-hi">TEMPO</h1>
        <FlareLine className="mx-auto mt-3 max-w-[100px]" />
        <p className="mt-6 text-sm text-text-lo">
          You need a review link from the track’s owner to open a bounce here.
        </p>
      </div>
    </div>
  );
}
