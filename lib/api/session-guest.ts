/**
 * Guest Session client. Plain fetch only. Zero imports of lib/supabase/client.ts.
 */

export type GuestSessionGate = {
  title: string;
};

export type GuestSessionState = {
  title: string;
  purpose: string;
  song: { title: string; artwork_url: string | null } | null;
  members: { display_name: string }[];
  agenda: { id: string; body: string; done: boolean }[];
  notes: string;
  pins: { id: string; title: string; artwork_url: string | null }[];
  messages: GuestSessionMessage[];
  /** True while an instance is open, so a guest can see the room went live. */
  live: boolean;
  hangStartedAt: string | null;
  notesActive: boolean;
  allowChat: boolean;
  allowMedia: boolean;
  guestName: string;
};

export type GuestSessionMessage = {
  id: string;
  body: string;
  created_at: string;
  author: string;
  mine: boolean;
  guest: boolean;
};

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function fetchGuestGate(token: string): Promise<GuestSessionGate> {
  const response = await fetch(`/api/sessions/public/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "This Session link isn’t available.");
  }
  return { title: typeof body.title === "string" ? body.title : "Session" };
}

export async function joinGuestSession(input: {
  token: string;
  passcode: string;
  displayName: string;
  website?: string;
}): Promise<void> {
  const response = await fetch(`/api/sessions/public/${encodeURIComponent(input.token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      passcode: input.passcode,
      display_name: input.displayName,
      website: input.website ?? "",
    }),
  });
  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "This Session link isn’t available.");
  }
}

export async function fetchGuestSessionState(token: string): Promise<GuestSessionState> {
  const response = await fetch(`/api/sessions/public/${encodeURIComponent(token)}/state`, {
    cache: "no-store",
  });
  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "This Session link isn’t available.");
  }
  return body as unknown as GuestSessionState;
}

export async function postGuestSessionMessage(token: string, text: string): Promise<void> {
  const response = await fetch(`/api/sessions/public/${encodeURIComponent(token)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: text, website: "" }),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Couldn’t send that.");
  }
}

export async function fetchGuestLiveKitToken(token: string): Promise<{
  token: string;
  url: string;
  roomName: string;
}> {
  const response = await fetch(`/api/sessions/public/${encodeURIComponent(token)}/livekit-token`, {
    method: "POST",
  });
  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Calls are not switched on right now.");
  }
  return {
    token: String(body.token ?? ""),
    url: String(body.url ?? ""),
    roomName: String(body.roomName ?? ""),
  };
}
