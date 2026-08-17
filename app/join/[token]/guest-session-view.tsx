"use client";

import * as React from "react";
import { CallControls } from "@/components/sessions/call-controls";
import { GuestGate } from "@/components/sessions/guest-gate";
import { ScreenSourcePicker } from "@/components/sessions/screen-source-picker";
import { SessionStage } from "@/components/sessions/session-stage";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSessionCall } from "@/hooks/use-session-call";
import {
  fetchGuestGate,
  fetchGuestLiveKitToken,
  fetchGuestSessionState,
  postGuestSessionMessage,
  type GuestSessionState,
} from "@/lib/api/session-guest";
import { SESSION_GUEST_UNAVAILABLE_MESSAGE } from "@/lib/sessions/copy";

export function GuestSessionView({ token }: { token: string }) {
  const [gateTitle, setGateTitle] = React.useState<string | null>(null);
  const [joined, setJoined] = React.useState(false);
  const [state, setState] = React.useState<GuestSessionState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");

  const loadState = React.useCallback(async () => {
    const next = await fetchGuestSessionState(token);
    setState(next);
    setJoined(true);
  }, [token]);

  React.useEffect(() => {
    let active = true;
    void fetchGuestGate(token)
      .then((gate) => {
        if (active) setGateTitle(gate.title);
      })
      .catch(() => {
        if (active) setError(SESSION_GUEST_UNAVAILABLE_MESSAGE);
      });
    void fetchGuestSessionState(token)
      .then((next) => {
        if (!active) return;
        setState(next);
        setJoined(true);
      })
      .catch(() => {
        /* still on the gate until the cookie exists */
      });
    return () => {
      active = false;
    };
  }, [token]);

  const call = useSessionCall({
    roomId: joined ? token : null,
    enabled: joined,
    fetchToken: () => fetchGuestLiveKitToken(token),
  });

  React.useEffect(() => {
    if (call.chatTick) void loadState();
  }, [call.chatTick, loadState]);

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg-0 px-4">
        <Wordmark className="mb-8" />
        <p className="text-sm text-text-lo">{error}</p>
      </div>
    );
  }

  if (!joined || !state) {
    if (!gateTitle) {
      return <div className="min-h-[100dvh] bg-bg-0" />;
    }
    return (
      <GuestGate
        token={token}
        title={gateTitle}
        onJoined={() => {
          void loadState();
        }}
      />
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg-0">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <Wordmark size={18} />
          <h1 className="mt-2 font-display text-lg font-semibold text-text-hi">{state.title}</h1>
          {state.purpose ? <p className="text-sm text-text-lo">{state.purpose}</p> : null}
        </div>
        <span className="glass-chip text-xs text-text-lo">You are here as a guest.</span>
      </header>
      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-[14rem] flex-1">
            <SessionStage room={call.room} onCall={call.onCallRoster} members={[]} />
          </div>
          <div className="panel-quiet space-y-3 p-3">
            {state.agenda.length ? (
              <ul className="space-y-1">
                {state.agenda.map((item) => (
                  <li key={item.id} className="text-sm text-text-hi">
                    {item.done ? "✓ " : ""}
                    {item.body}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-lo">No agenda yet.</p>
            )}
            {state.notes ? <p className="whitespace-pre-wrap text-sm text-text-lo">{state.notes}</p> : null}
            {state.pins.length ? (
              <ul className="grid grid-cols-2 gap-2">
                {state.pins.map((pin) => (
                  <li key={pin.id} className="well p-2">
                    {pin.artwork_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pin.artwork_url} alt="" className="mb-2 h-16 w-full rounded-input object-cover" />
                    ) : null}
                    <p className="truncate text-xs text-text-hi">{pin.title}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <aside className="panel-quiet flex min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {state.messages.map((message) => (
              <div key={message.id} className={message.mine ? "text-right" : "text-left"}>
                <p className="text-[11px] text-text-lo">
                  {message.author}
                  {message.guest ? " · guest" : ""}
                </p>
                <p className="inline-block rounded-card bg-bg-2 px-3 py-2 text-sm text-text-hi">{message.body}</p>
              </div>
            ))}
          </div>
          {state.allowChat ? (
            <form
              className="border-t border-line p-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!draft.trim()) return;
                void postGuestSessionMessage(token, draft.trim())
                  .then(() => {
                    setDraft("");
                    call.publishChat();
                    return loadState();
                  })
                  .catch(() => {});
              }}
            >
              <Textarea rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Message the Session..." />
              <Button type="submit" size="sm" className="mt-2" disabled={!draft.trim()}>
                Send
              </Button>
            </form>
          ) : (
            <p className="border-t border-line p-3 text-xs text-text-lo">Chat is off for guests on this link.</p>
          )}
        </aside>
      </div>
      {state.allowMedia ? (
        <CallControls
          onCall={call.onCall}
          micEnabled={call.micEnabled}
          cameraEnabled={call.cameraEnabled}
          screenEnabled={call.screenEnabled}
          onJoin={() => void call.joinCall()}
          onLeave={() => void call.leaveCall()}
          onToggleMic={() => void call.toggleMic()}
          onToggleCamera={() => void call.toggleCamera()}
          onToggleScreen={() => void call.toggleScreen()}
        />
      ) : null}
      <ScreenSourcePicker />
    </div>
  );
}
