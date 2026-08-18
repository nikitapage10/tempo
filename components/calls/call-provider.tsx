"use client";

import * as React from "react";
import { SessionAudio } from "@/components/sessions/session-audio";
import { useSessionCall } from "@/hooks/use-session-call";

export type CallScope = "session" | "conversation" | "support";
export type CallTarget = {
  scope: CallScope;
  id: string;
  title: string;
  href: string;
};

type CallContextValue = ReturnType<typeof useSessionCall> & {
  target: CallTarget | null;
  activate: (target: CallTarget) => void;
  start: (target: CallTarget) => void;
  answer: (target: CallTarget) => void;
  clear: () => void;
};

const CallContext = React.createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = React.useState<CallTarget | null>(null);
  const [pendingJoin, setPendingJoin] = React.useState<string | null>(null);
  const call = useSessionCall({
    roomId: target?.id ?? null,
    enabled: Boolean(target),
    scope: target?.scope,
  });
  const activate = React.useCallback((next: CallTarget) => {
    setTarget((current) =>
      current?.scope === next.scope && current.id === next.id ? current : next,
    );
  }, []);
  const begin = React.useCallback((next: CallTarget, ring: boolean) => {
    if (target && (target.scope !== next.scope || target.id !== next.id) && call.onCall) {
      if (!window.confirm(`Leave ${target.title} and join ${next.title}?`)) return;
      void call.leaveCall();
    }
    setTarget(next);
    setPendingJoin(`${next.scope}:${next.id}`);
    if (ring) {
      void fetch(`/api/calls/${next.scope}/${next.id}/ring`, { method: "POST" });
    }
  }, [call, target]);
  const start = React.useCallback((next: CallTarget) => begin(next, true), [begin]);
  const answer = React.useCallback((next: CallTarget) => begin(next, false), [begin]);

  React.useEffect(() => {
    if (!target || !call.connected || pendingJoin !== `${target.scope}:${target.id}`) return;
    setPendingJoin(null);
    void call.joinCall();
  }, [call, pendingJoin, target]);
  const clear = React.useCallback(() => {
    void call.leaveCall().finally(() => setTarget(null));
  }, [call]);

  const value = React.useMemo(
    () => ({ ...call, target, activate, start, answer, clear }),
    [activate, answer, call, clear, start, target],
  );

  return (
    <CallContext.Provider value={value}>
      {target ? <SessionAudio room={call.room} /> : null}
      {children}
    </CallContext.Provider>
  );
}

export function useCall(): CallContextValue {
  const value = React.useContext(CallContext);
  if (!value) throw new Error("useCall must be used inside CallProvider");
  return value;
}
