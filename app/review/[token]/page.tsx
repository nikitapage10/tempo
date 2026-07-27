import type { Metadata } from "next";
import { GuestReviewView } from "./guest-review-view";

// Guest review pages are public, single-purpose, and must never be indexed
// or leak referrer data back to whatever page linked here
// (SECURITY-AND-PERMISSIONS.md §2/§T3, FEATURE-SPECS §5 non-goals).
export const metadata: Metadata = {
  title: "Track review — TEMPO",
  description: "A private, time-limited TEMPO review link.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  referrer: "no-referrer",
};

export default function GuestReviewPage({
  params,
}: {
  params: { token: string };
}) {
  return <GuestReviewView token={params.token} />;
}
