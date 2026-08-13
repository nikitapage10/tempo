export async function requestArtistInvite(input: {
  email: string;
  note?: string;
  trackId?: string;
  artistId?: string;
}): Promise<{ id: string }> {
  const response = await fetch("/api/artist-invite-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? "Couldn’t send that invite request.");
  }
  return body as { id: string };
}
