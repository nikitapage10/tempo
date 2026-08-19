"use client";

import * as React from "react";
import { Phone, PhoneOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCall } from "@/components/calls/call-provider";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createClient } from "@/lib/supabase/client";

type Incoming = {
  entity_id: string;
  entity_type?: string;
  title: string;
  body: string | null;
  link_url: string | null;
};

export function IncomingCall() {
  const user = useCurrentUser();
  const router = useRouter();
  const call = useCall();
  const [incoming, setIncoming] = React.useState<Incoming | null>(null);
  const markMissed = React.useCallback((call: Incoming) => {
    const scope = call.entity_type === "support_report" ? "support" : "conversation";
    void fetch(`/api/calls/${scope}/${call.entity_id}/missed`, { method: "POST" });
  }, []);

  React.useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`tempo-incoming-call-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as Incoming & { type?: string };
          if (row.type !== "call_incoming" || !row.entity_id) return;
          setIncoming(row);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  React.useEffect(() => {
    if (!incoming) return;
    const timer = window.setTimeout(() => {
      markMissed(incoming);
      setIncoming(null);
    }, 45_000);
    return () => window.clearTimeout(timer);
  }, [incoming, markMissed]);

  if (!incoming) return null;
  const support = incoming.entity_type === "support_report";
  const href = incoming.link_url?.replace("&answer=1", "") || (support ? `/messages?support=${incoming.entity_id}` : `/messages?c=${incoming.entity_id}`);
  return (
    <div className="fixed bottom-24 right-4 z-[80] w-[min(22rem,calc(100vw-2rem))] rounded-panel border border-amber/35 bg-bg-1/95 p-4 shadow-e3 backdrop-blur-xl">
      <p className="label-mono text-amber">Incoming call</p>
      <p className="mt-2 text-sm font-medium text-text-hi">{incoming.title}</p>
      {incoming.body ? <p className="mt-1 text-xs text-text-lo">{incoming.body}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="inline-flex items-center gap-1 rounded-chip border border-line px-3 py-2 text-xs text-text-lo" onClick={() => { markMissed(incoming); setIncoming(null); }}>
          <PhoneOff className="size-3.5" />
          Decline
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-chip bg-ice px-3 py-2 text-xs font-medium text-bg-0"
          onClick={() => {
            call.answer({ scope: support ? "support" : "conversation", id: incoming.entity_id, title: incoming.body || "Call", href });
            setIncoming(null);
            router.push(href);
          }}
        >
          <Phone className="size-3.5" />
          Answer
        </button>
      </div>
    </div>
  );
}
