import type { Metadata } from "next";
import { GuestSessionView } from "./guest-session-view";

export const metadata: Metadata = {
  title: "Join a Session — TEMPO",
  description: "A private TEMPO Session link.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  referrer: "no-referrer",
};

export default function JoinSessionPage({ params }: { params: { token: string } }) {
  return <GuestSessionView token={params.token} />;
}
