"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, MicOff, PhoneOff, Radio } from "lucide-react";
import { useCall } from "@/components/calls/call-provider";

export function CallDock() {
  const pathname = usePathname();
  const call = useCall();
  if (!call.target || !call.onCall || pathname === call.target.href) return null;

  return (
    <div className="mx-2 mb-2 rounded-panel border border-amber/35 bg-bg-1/95 p-2 shadow-e2">
      <div className="flex items-center gap-2">
        <Radio className="size-3.5 text-amber" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-text-hi">{call.target.title}</p>
          <Link href={call.target.href} className="text-[11px] text-ice hover:underline">
            Back to it
          </Link>
        </div>
        <button
          type="button"
          aria-label={call.micEnabled ? "Mute microphone" : "Turn microphone on"}
          className="rounded-full border border-line p-2 text-text-hi hover:border-ice/40"
          onClick={() => void call.toggleMic()}
        >
          {call.micEnabled ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
        </button>
        <button
          type="button"
          aria-label="Leave call"
          className="rounded-full border border-warn/40 p-2 text-warn"
          onClick={() => call.clear()}
        >
          <PhoneOff className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
