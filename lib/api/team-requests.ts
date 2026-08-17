import type { ProfileSearchResult } from "@/lib/api/artist-profile";
import type { AreaGrants } from "@/lib/team/areas";
import type { MemberRole } from "@/lib/team/roles";

export type TeamRequestStatus = "pending" | "invited" | "declined" | "cancelled";

export type TeamRequestPerson = Pick<
  ProfileSearchResult,
  | "id"
  | "artist_id"
  | "profile_kind"
  | "handle"
  | "display_name"
  | "emblem_url"
  | "palette_id"
  | "ice_color"
  | "amber_color"
  | "tagline"
>;

export type ArtistTeamRequest = {
  id: string;
  artistId: string;
  requestedRole: MemberRole;
  note: string | null;
  status: TeamRequestStatus;
  membershipId: string | null;
  createdAt: string;
  respondedAt: string | null;
  artist: TeamRequestPerson | null;
  requester: TeamRequestPerson | null;
};

async function requestJson(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Record<string, unknown>> {
  const response = await fetch(input, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : "Couldn’t update that team request."
    );
  }
  return body as Record<string, unknown>;
}

export async function listMyTeamRequests(): Promise<ArtistTeamRequest[]> {
  const body = await requestJson("/api/team-request");
  return Array.isArray(body.requests) ? (body.requests as ArtistTeamRequest[]) : [];
}

export async function listArtistTeamRequests(
  artistId: string
): Promise<ArtistTeamRequest[]> {
  const body = await requestJson(`/api/team-request?artistId=${encodeURIComponent(artistId)}`);
  return Array.isArray(body.requests) ? (body.requests as ArtistTeamRequest[]) : [];
}

export async function createArtistTeamRequest(input: {
  artistId: string;
  role: MemberRole;
  note?: string;
}): Promise<ArtistTeamRequest> {
  const body = await requestJson("/api/team-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return body.request as ArtistTeamRequest;
}

export async function cancelArtistTeamRequest(id: string): Promise<void> {
  await requestJson(`/api/team-request/${id}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "cancel" }),
  });
}

export async function respondToArtistTeamRequest(input: {
  id: string;
  action: "decline" | "invite";
  role?: MemberRole;
  areas?: AreaGrants;
  inviteMessage?: string;
}): Promise<void> {
  await requestJson(`/api/team-request/${input.id}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: input.action,
      role: input.role,
      areas: input.areas,
      inviteMessage: input.inviteMessage,
    }),
  });
}
