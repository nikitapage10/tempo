/**
 * Server-only: create an artist-team invite for an email or an existing
 * TEMPO person (handle / profile). Existing members get an in-app
 * notification and must approve; people not on TEMPO get the email link.
 */

import { randomBytes, createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authUserByEmail } from "@/lib/auth/account-exists";
import { sendTeamInviteEmail } from "@/lib/team/invite-email";
import { MEMBER_ROLES, ROLE_LABELS, presetForRole, type MemberRole } from "@/lib/team/roles";
import type { AreaGrants } from "@/lib/team/areas";
import { siteOrigin } from "@/lib/tokens";

export type CreateMemberInviteInput = {
  artistId: string;
  role: MemberRole;
  invitedByUserId: string;
  invitedByEmail: string | null;
  email?: string | null;
  handle?: string | null;
  profileId?: string | null;
  areaOverrides?: AreaGrants;
  relationshipLabel?: string | null;
  inviteMessage?: string | null;
};

export type CreatedMemberInvite = {
  kind: "existing" | "email";
  memberId: string;
  rawToken: string | null;
  emailSent: boolean;
  emailReason?: string;
};

function sha256HexServer(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function newRawToken(): string {
  return randomBytes(32).toString("hex");
}

function defaultInviteExpiry(days = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

function isMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value);
}

function missingMembersTable(message: string): boolean {
  return /artist_members|schema cache|does not exist/i.test(message);
}

async function displayNameForUser(
  admin: SupabaseClient,
  userId: string,
  fallback: string
): Promise<string> {
  const [{ data: member }, { data: profile }] = await Promise.all([
    admin
      .from("artist_member_profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("artist_profiles")
      .select("display_name")
      .eq("owner_user_id", userId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const memberName =
    typeof member?.display_name === "string" ? member.display_name.trim() : "";
  const profileName =
    typeof profile?.display_name === "string" ? profile.display_name.trim() : "";
  return memberName || profileName || fallback;
}

async function notifyInvitee(input: {
  admin: SupabaseClient;
  userId: string;
  memberId: string;
  artistName: string;
  role: MemberRole;
  invitedByName: string;
}): Promise<void> {
  const roleLabel = ROLE_LABELS[input.role];
  await input.admin.from("notifications").insert({
    user_id: input.userId,
    type: "team_invite",
    title: `${input.artistName} invited you to their team`,
    body: `${input.invitedByName} wants you on as ${roleLabel}. Approve to get access.`,
    entity_type: "artist_member",
    entity_id: input.memberId,
    link_url: "/team",
    group_key: `team-invite:${input.memberId}`,
  });
}

async function sendEmailIfConfigured(input: {
  email: string;
  artistName: string;
  role: MemberRole;
  invitedByEmail: string;
  rawToken: string;
  expiresAt: string;
  memberId: string;
  areas: AreaGrants;
  relationshipLabel?: string | null;
  inviteMessage?: string | null;
}): Promise<{ emailSent: boolean; emailReason?: string }> {
  if (!process.env.RESEND_API_KEY || !process.env.INVITE_FROM_EMAIL) {
    return { emailSent: false, emailReason: "not_configured" };
  }
  try {
    await sendTeamInviteEmail({
      email: input.email,
      artistName: input.artistName,
      role: input.role,
      invitedByEmail: input.invitedByEmail,
      inviteUrl: `${siteOrigin()}/team-invite/${input.rawToken}`,
      expiresAt: input.expiresAt,
      idempotencyKey: `team-invite/${input.memberId}/send/1`,
      areas: input.areas,
      relationshipLabel: input.relationshipLabel,
      inviteMessage: input.inviteMessage,
    });
    return { emailSent: true };
  } catch (err) {
    console.error("[team-invite][create] email", err);
    return {
      emailSent: false,
      emailReason: err instanceof Error ? err.message : "send_failed",
    };
  }
}

export async function createMemberInvite(
  admin: SupabaseClient,
  input: CreateMemberInviteInput
): Promise<CreatedMemberInvite> {
  if (!isMemberRole(input.role)) {
    throw Object.assign(new Error("Pick a team role."), { status: 400 });
  }

  const { data: artist, error: artistError } = await admin
    .from("artists")
    .select("id, name, user_id, demo_kind")
    .eq("id", input.artistId)
    .maybeSingle();
  if (artistError || !artist) {
    throw Object.assign(new Error("That artist isn’t available."), { status: 404 });
  }
  if (artist.user_id !== input.invitedByUserId) {
    throw Object.assign(new Error("Only the artist can invite people to this team."), {
      status: 403,
    });
  }
  if (artist.demo_kind) {
    throw Object.assign(new Error("Demo artists don’t have a live team."), { status: 400 });
  }

  const email =
    typeof input.email === "string" && input.email.trim().includes("@")
      ? input.email.trim().toLowerCase()
      : null;
  const profileId =
    typeof input.profileId === "string" && input.profileId.trim()
      ? input.profileId.trim()
      : null;
  const handle =
    typeof input.handle === "string" && input.handle.trim()
      ? normalizeHandle(input.handle)
      : null;

  if (!email && !profileId && !handle) {
    throw Object.assign(new Error("Add an email or a TEMPO handle."), { status: 400 });
  }

  let targetUserId: string | null = null;
  let targetEmail = email;

  if (profileId || handle) {
    let query = admin
      .from("artist_profiles")
      .select("id, owner_user_id, artist_id, handle, display_name");
    if (profileId) query = query.eq("id", profileId);
    else query = query.eq("handle", handle);
    const { data: profile, error: profileError } = await query.maybeSingle();
    if (profileError) {
      throw Object.assign(new Error(profileError.message), { status: 500 });
    }
    if (!profile?.owner_user_id) {
      throw Object.assign(
        new Error("Couldn’t find anyone with that handle. Try their email instead."),
        { status: 404 }
      );
    }
    const { data: profileArtist } = await admin
      .from("artists")
      .select("demo_kind")
      .eq("id", profile.artist_id)
      .maybeSingle();
    if (profileArtist?.demo_kind) {
      throw Object.assign(new Error("That’s a demo artist — pick a real TEMPO member."), {
        status: 400,
      });
    }
    const ownerId = profile.owner_user_id;
    targetUserId = ownerId;
    if (!targetEmail) {
      const { data: authUser, error: authError } = await admin.auth.admin.getUserById(ownerId);
      if (!authError && authUser.user?.email) {
        targetEmail = authUser.user.email.toLowerCase();
      }
    }
  } else if (email) {
    const found = await authUserByEmail(email);
    if (found) {
      targetUserId = found.id;
      targetEmail = found.email;
    }
  }

  if (targetUserId === input.invitedByUserId) {
    throw Object.assign(new Error("You’re already the owner of this artist."), {
      status: 400,
    });
  }

  const { data: existingRows, error: existingError } = await admin
    .from("artist_members")
    .select("id, user_id, invited_email, status")
    .eq("artist_id", input.artistId);
  if (existingError && !missingMembersTable(existingError.message)) {
    throw Object.assign(new Error(existingError.message), { status: 500 });
  }
  if (existingError && missingMembersTable(existingError.message)) {
    throw Object.assign(
      new Error(
        "Team accounts aren’t set up in the database yet — run migrations 089–097 in Supabase, then try again."
      ),
      { status: 503 }
    );
  }

  const existing = (existingRows ?? []).find((row) => {
    if (row.status === "revoked") return false;
    if (targetUserId && row.user_id === targetUserId) return true;
    if (targetEmail && row.invited_email?.toLowerCase() === targetEmail) return true;
    return false;
  });
  if (existing?.status === "active") {
    throw Object.assign(new Error("They’re already on this team."), { status: 409 });
  }
  if (existing?.status === "suspended") {
    throw Object.assign(
      new Error("They already belong to this team and are suspended. Resume their access instead."),
      { status: 409 }
    );
  }
  if (existing?.status === "pending") {
    throw Object.assign(new Error("They already have a pending invite for this artist."), {
      status: 409,
    });
  }

  const rawToken = newRawToken();
  const tokenHash = sha256HexServer(rawToken);
  const expiresAt = defaultInviteExpiry();
  const areas = { ...presetForRole(input.role), ...input.areaOverrides };

  const payload = {
    artist_id: input.artistId,
    user_id: targetUserId,
    invited_email: targetEmail,
    role: input.role,
    areas,
    status: "pending" as const,
    invited_by: input.invitedByUserId,
    invite_token_hash: tokenHash,
    expires_at: expiresAt,
    relationship_label: input.relationshipLabel?.trim() || null,
    invite_message: input.inviteMessage?.trim() || null,
    suspended_at: null,
    suspended_by_user_id: null,
    revoked_at: null,
    revoked_by_user_id: null,
    ended_reason: null,
  };

  const revoked = (existingRows ?? []).find((row) => {
    if (row.status !== "revoked" && row.status !== "declined") return false;
    if (targetUserId && row.user_id === targetUserId) return true;
    if (targetEmail && row.invited_email?.toLowerCase() === targetEmail) return true;
    return false;
  });

  const write = revoked
    ? admin.from("artist_members").update(payload).eq("id", revoked.id).select("id").single()
    : admin.from("artist_members").insert(payload).select("id").single();
  const { data: saved, error: saveError } = await write;
  if (saveError || !saved) {
    const message = saveError?.message || "Couldn’t create that invite — try again.";
    if (missingMembersTable(message)) {
      throw Object.assign(
        new Error(
          "Team accounts aren’t set up in the database yet — run migrations 089–097 in Supabase, then try again."
        ),
        { status: 503 }
      );
    }
    if (/artist_members_pending_|artist_members_active_user|duplicate/i.test(message)) {
      throw Object.assign(new Error("They already have a pending invite for this artist."), {
        status: 409,
      });
    }
    throw Object.assign(new Error(message), { status: 500 });
  }

  await admin.from("artist_membership_events").insert({
    artist_id: input.artistId,
    membership_id: saved.id,
    subject_user_id: targetUserId,
    actor_user_id: input.invitedByUserId,
    event_type: "invited",
    changes: { role: input.role, areas },
  }).then(() => {}, () => {});

  const kind: "existing" | "email" = targetUserId ? "existing" : "email";
  const invitedByName = await displayNameForUser(
    admin,
    input.invitedByUserId,
    input.invitedByEmail?.split("@")[0] || "A TEMPO artist"
  );

  if (targetUserId) {
    try {
      await notifyInvitee({
        admin,
        userId: targetUserId,
        memberId: saved.id,
        artistName: artist.name,
        role: input.role,
        invitedByName,
      });
    } catch (err) {
      console.error("[team-invite][create] notify", err);
    }
  }

  let emailSent = false;
  let emailReason: string | undefined;
  if (targetEmail) {
    const sent = await sendEmailIfConfigured({
      email: targetEmail,
      artistName: artist.name,
      role: input.role,
      invitedByEmail: input.invitedByEmail || invitedByName,
      rawToken,
      expiresAt,
      memberId: saved.id,
      areas,
      relationshipLabel: input.relationshipLabel,
      inviteMessage: input.inviteMessage,
    });
    emailSent = sent.emailSent;
    emailReason = sent.emailReason;
  }

  return {
    kind,
    memberId: saved.id,
    rawToken: kind === "email" ? rawToken : null,
    emailSent,
    emailReason,
  };
}
