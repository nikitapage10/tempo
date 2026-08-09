"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { redeemSceneInviteLink } from "@/lib/api/scene-invites";

export default function SceneInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [error, setError] = React.useState("");
  React.useEffect(() => { let active = true; redeemSceneInviteLink(params.token).then((slug) => { if (active) router.replace(`/scene/${slug}`); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "This invitation is no longer available."); }); return () => { active = false; }; }, [params.token, router]);
  return <div className="mx-auto grid min-h-[60vh] max-w-xl place-items-center"><div className="panel w-full p-8 text-center">{error ? <><h1 className="font-display text-xl font-semibold text-text-hi">Invitation unavailable</h1><p className="mt-2 text-sm text-text-lo">{error}</p></> : <><Loader2 className="mx-auto size-6 animate-spin text-ice" /><h1 className="mt-4 font-display text-xl font-semibold text-text-hi">Opening the Scene</h1><p className="mt-2 text-sm text-text-lo">Setting up your member identity and invitation…</p></>}</div></div>;
}
