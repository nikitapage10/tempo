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
  clear: () => void;
};

const CallContext = React.createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = React.useState<CallTarget | null>(null);
  const call = useSessionCall({
    roomId: target?.scope === "session" ? target.id : null,
    enabled: target?.scope === "session",
  });
  const activate = React.useCallback((next: CallTarget) => {
    setTarget((current) =>
      current?.scope === next.scope && current.id === next.id ? current : next,
    );
  }, []);
  const clear = React.useCallback(() => {
    void call.leaveCall().finally(() => setTarget(null));
  }, [call]);

  const value = React.useMemo(
    () => ({ ...call, target, activate, clear }),
    [activate, call, clear, target],
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
