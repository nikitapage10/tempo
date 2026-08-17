export const HIDDEN_DISCONNECT_MS = 60_000;

/**
 * Everyone who opens a Session connects to LiveKit immediately. A background
 * tab that stays connected bills connection minutes all day. Disconnect when
 * the tab has been hidden for 60 seconds unless the person is on the call;
 * reconnect on focus.
 */
export function shouldDisconnectWhenHidden(input: {
  hidden: boolean;
  onCall: boolean;
  hiddenForMs: number;
}): boolean {
  return input.hidden && !input.onCall && input.hiddenForMs >= HIDDEN_DISCONNECT_MS;
}

export function visibilityHiddenForMs(
  hiddenSince: number | null,
  now = Date.now()
): number {
  if (hiddenSince == null) return 0;
  return Math.max(0, now - hiddenSince);
}
