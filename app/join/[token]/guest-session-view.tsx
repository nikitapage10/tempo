"use client";

import * as React from "react";
import { CallControls } from "@/components/sessions/call-controls";
import { GuestGate } from "@/components/sessions/guest-gate";
import { ScreenSourcePicker } from "@/components/sessions/screen-source-picker";
import { LivePill } from "@/components/sessions/session-people";
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
import { cn } from "@/lib/utils";

/** A guest has no realtime channel of their own, so the room state is polled. */
const STATE_POLL_MS = 15_000;

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

  React.useEffect(() => {
    if (!joined) return;
    const timer = window.setInterval(() => {
      void loadState().catch(() => {});
    }, STATE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [joined, loadState]);

  // Stable across renders: a new function each time would tear the LiveKit
  // connection down and back up, and the guest would miss the call starting.
  const fetchToken = React.useCallback(() => fetchGuestLiveKitToken(token), [token]);

  const call = useSessionCall({
    roomId: joined ? token : null,
    enabled: joined,
    fetchToken,
  });

  React.useEffect(() => {
    if (call.chatTick) void loadState().catch(() => {});
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

  const live = state.live || call.onCallRoster.length > 0;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg-0">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <Wordmark size={18} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="truncate font-display text-lg font-semibold text-text-hi">{state.title}</h1>
            {live ? <LivePill label="Hang is open" /> : null}
          </div>
          {state.purpose ? <p className="mt-1 text-sm text-text-lo">{state.purpose}</p> : null}
        </div>
        <span className="glass-chip px-3 py-1 text-xs text-text-lo">
          You are here as a guest{state.guestName ? `, ${state.guestName}` : ""}.
        </span>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-h-0 flex-col gap-3">
          <section className="panel flex min-h-[18rem] flex-1 flex-col gap-3 p-3">
            <div className="min-h-[12rem] flex-1">
              <SessionStage
                room={call.room}
                onCall={call.onCallRoster}
                members={[]}
                live={live}
                action={
                  state.allowMedia && !call.onCall ? (
                    <Button type="button" size="sm" onClick={() => void call.joinCall()} disabled={Boolean(call.error)}>
                      Join the call
                    </Button>
                  ) : null
                }
              />
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
                disabled={Boolean(call.error)}
              />
            ) : (
              <p className="text-center text-xs text-text-lo">Mic and camera are off for guests on this link.</p>
            )}
            {call.error ? <p className="text-center text-xs text-warn">{call.error}</p> : null}
          </section>

          <section className="panel-quiet space-y-3 p-4">
            <p className="label-mono">Agenda</p>
            {state.agenda.length ? (
              <ul className="space-y-1.5">
                {state.agenda.map((item) => (
                  <li
                    key={item.id}
                    className={cn("well px-3 py-2 text-sm", item.done ? "text-text-lo line-through" : "text-text-hi")}
                  >
                    {item.body}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-lo">Nothing on the agenda yet.</p>
            )}
            {state.notes ? (
              <div>
                <p className="label-mono mb-2">Notes</p>
                <p className="whitespace-pre-wrap text-sm leading-6 text-text-lo">{state.notes}</p>
              </div>
            ) : null}
            {state.pins.length ? (
              <div>
                <p className="label-mono mb-2">Pinned</p>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {state.pins.map((pin) => (
                    <li key={pin.id} className="well overflow-hidden p-2">
                      {pin.artwork_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pin.artwork_url} alt="" className="mb-2 h-16 w-full rounded-input object-cover" />
                      ) : null}
                      <p className="truncate text-xs text-text-hi">{pin.title}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="panel-quiet flex min-h-[20rem] flex-col overflow-hidden">
          <p className="label-mono border-b border-line/70 px-3 py-3">Room chat</p>
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-y-auto p-3">
            {state.messages.length === 0 ? (
              <p className="text-sm text-text-lo">No messages yet. Say hello.</p>
            ) : (
              state.messages.map((message) => (
                <div key={message.id} className={cn("flex flex-col gap-1", message.mine ? "items-end" : "items-start")}>
                  <p className="text-[11px] text-text-lo">
                    {message.author}
                    {message.guest ? " · guest" : ""}
                  </p>
                  <p
                    className={cn(
                      "max-w-[85%] rounded-card px-3 py-2 text-sm",
                      message.mine ? "bg-ice/15 text-text-hi" : "bg-bg-2 text-text-hi"
                    )}
                  >
                    {message.body}
                  </p>
                </div>
              ))
            )}
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
              <Textarea
                rows={2}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Message the Session..."
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <Button type="submit" size="sm" className="mt-2 w-full" disabled={!draft.trim()}>
                Send
              </Button>
            </form>
          ) : (
            <p className="border-t border-line p-3 text-xs text-text-lo">Chat is off for guests on this link.</p>
          )}
        </aside>
      </div>
      <ScreenSourcePicker />
    </div>
  );
}
