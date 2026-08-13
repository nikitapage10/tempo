import { ROLE_LABELS, type MemberRole } from "@/lib/team/roles";

type TeamInviteEmail = {
  email: string;
  artistName: string;
  role: MemberRole;
  invitedByEmail: string;
  inviteUrl: string;
  expiresAt: string | null;
  idempotencyKey: string;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character
  );
}

function providerError(status: number, body: unknown) {
  const result = body && typeof body === "object" ? (body as { name?: unknown; message?: unknown }) : null;
  const name = typeof result?.name === "string" ? result.name : "";
  const raw = typeof result?.message === "string" ? result.message.replace(/\s+/g, " ").trim().slice(0, 240) : "";
  if (name === "invalid_api_key" || status === 401) return "Resend rejected the API key. Replace RESEND_API_KEY in the production environment and redeploy.";
  if (/only send testing emails/i.test(raw)) return "Resend is still in testing mode. Verify a sending domain, then set INVITE_FROM_EMAIL to an address on that domain.";
  if (/domain.+not verified/i.test(raw)) return `${raw} Set INVITE_FROM_EMAIL to an address on a verified Resend domain.`;
  if (/from/i.test(raw) || name === "validation_error") return `Resend rejected the sender configuration: ${raw || "check INVITE_FROM_EMAIL and its verified domain."}`;
  if (status === 429) return "Resend rate-limited this request. Wait a moment, then retry.";
  return raw ? `Resend rejected the invitation: ${raw}` : `Resend rejected the invitation (HTTP ${status}).`;
}

/**
 * Mirrors lib/admin/invite-email.ts's dark-glass template, adapted for a
 * team invite: no invite code (the link itself carries the token), names
 * the artist and role, and says plainly that this skips Origin — the
 * recipient still creates a real account the normal way, they just aren't
 * onboarding as an artist.
 */
export function renderTeamInviteEmail(input: Omit<TeamInviteEmail, "idempotencyKey">) {
  const safeArtist = escapeHtml(input.artistName);
  const safeLink = escapeHtml(input.inviteUrl);
  const safeInviter = escapeHtml(input.invitedByEmail);
  const label = ROLE_LABELS[input.role];
  const expiry = input.expiresAt
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(input.expiresAt))
    : null;
  const expiryCopy = expiry
    ? `This invitation is available through ${escapeHtml(expiry)}.`
    : "This invitation does not have a scheduled expiry.";

  const html = `<!doctype html>
<html>
<body style="margin:0;background:#0A0A0C;color:#F2F0EB;font-family:Inter,Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0A0C;background-image:radial-gradient(ellipse at 20% 0%,rgba(127,180,255,0.16),transparent 52%),radial-gradient(ellipse at 90% 10%,rgba(255,181,107,0.10),transparent 45%),radial-gradient(ellipse at 50% 100%,rgba(157,140,255,0.08),transparent 50%);padding:36px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid rgba(242,240,235,0.10);border-radius:18px;background:rgba(18,18,22,0.88);overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.45)">
          <tr>
            <td style="height:2px;background:linear-gradient(90deg,transparent,#7FB4FF,#F2F0EB,#FFB56B,transparent)"></td>
          </tr>
          <tr>
            <td style="padding:34px 32px 30px">
              <div style="font-family:'Space Grotesk',Arial,sans-serif;font-size:26px;font-weight:700;letter-spacing:-1px">TEMPO</div>
              <div style="margin-top:28px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#FFB56B">You’re invited to the team</div>
              <h1 style="margin:10px 0 12px;font-family:'Space Grotesk',Arial,sans-serif;font-size:28px;line-height:1.2;color:#F2F0EB">Work with ${safeArtist} as ${escapeHtml(label)}.</h1>
              <p style="margin:0;color:#B6B5BE;font-size:15px;line-height:1.65">${safeInviter} added you to their TEMPO team. You'll get access to exactly what they've granted you — calendar, catalog, performances, or stats, depending on your role. Create your TEMPO account the normal way; there's no artist setup to do, since this isn't your own catalog.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0 0">
                <tr>
                  <td align="center" style="border-radius:10px;background:#7FB4FF">
                    <a href="${safeLink}" style="display:block;padding:14px 22px;color:#0A0A0C;font-size:14px;font-weight:600;text-decoration:none">Accept invite</a>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 0;color:#8B8B96;font-size:12px;line-height:1.65">${expiryCopy}<br><br>If the button doesn’t work, copy this address:<br><a href="${safeLink}" style="color:#7FB4FF;word-break:break-all">${safeLink}</a></p>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;color:#62626D;font-size:11px">This invitation was sent specifically to ${escapeHtml(input.email)}.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${input.invitedByEmail} added you to their TEMPO team, working with ${input.artistName} as ${label}.

You'll get access to exactly what they've granted you. Create your TEMPO account the normal way — there's no artist setup to do, since this isn't your own catalog.

Accept invite: ${input.inviteUrl}

${expiryCopy}`;

  return { subject: `You're invited to work with ${input.artistName} on TEMPO`, html, text };
}

export async function sendTeamInviteEmail(input: TeamInviteEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Team invite email delivery is not configured.");
  const message = renderTeamInviteEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({ from, to: [input.email], subject: message.subject, html: message.html, text: message.text }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.id !== "string") throw new Error(providerError(response.status, body));
  return { providerId: body.id as string };
}
