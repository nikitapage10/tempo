type InviteEmail = {
  code: string;
  email: string;
  memberRole: "artist" | "team_member" | "administrator";
  welcomeNote: string | null;
  expiresAt: string | null;
  idempotencyKey: string;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character,
  );
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mytempo.dev").replace(/\/$/, "");
}

export function inviteLink(code: string) {
  return `${siteUrl()}/register?invite=${encodeURIComponent(code)}`;
}

/** Bare address from `Name <addr@domain>` or a plain address. */
export function parseFromAddress(from: string) {
  const trimmed = from.trim();
  return trimmed.match(/<([^>]+)>/)?.[1]?.trim() ?? trimmed;
}

/** Prefer an explicit display name; otherwise `TEMPO <addr>`. */
export function formatFromHeader(from: string) {
  const trimmed = from.trim();
  if (!trimmed) return trimmed;
  if (/<[^>]+>/.test(trimmed)) return trimmed;
  return `TEMPO <${trimmed}>`;
}

export function resolveReplyTo(from: string, replyToEnv?: string | null) {
  const explicit = replyToEnv?.trim() ?? "";
  if (explicit) return parseFromAddress(explicit);
  return parseFromAddress(from);
}

/**
 * True when the app host is the sending domain or a subdomain of it
 * (e.g. app.nikita.page ↔ nikita.page). Different registrable domains
 * (mytempo.dev ↔ nikita.page) fail — a common spam signal.
 */
export function linkDomainAligned(siteHost: string | null, fromDomain: string | null) {
  if (!siteHost || !fromDomain) return false;
  const host = siteHost.toLowerCase();
  const domain = fromDomain.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}

export function inviteDeliveryConfig() {
  const fromRaw = process.env.INVITE_FROM_EMAIL?.trim() ?? "";
  const from = fromRaw ? formatFromHeader(fromRaw) : "";
  const address = parseFromAddress(from);
  const domain = address.includes("@") ? address.split("@").at(-1)?.toLowerCase() ?? null : null;
  let siteHost: string | null = null;
  try {
    siteHost = new URL(siteUrl()).hostname.toLowerCase();
  } catch {
    siteHost = null;
  }
  return {
    configured: Boolean(process.env.RESEND_API_KEY?.trim() && fromRaw),
    apiKeyPresent: Boolean(process.env.RESEND_API_KEY?.trim()),
    fromPresent: Boolean(fromRaw),
    from: from || null,
    domain,
    siteHost,
    linkDomainAligned: linkDomainAligned(siteHost, domain),
    replyTo: fromRaw ? resolveReplyTo(fromRaw, process.env.INVITE_REPLY_TO_EMAIL) : null,
  };
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

function roleLabel(role: InviteEmail["memberRole"]) {
  if (role === "administrator") return "Admin";
  if (role === "team_member") return "Team member";
  return "Artist";
}

export function renderInviteEmail(input: Omit<InviteEmail, "idempotencyKey">) {
  const link = inviteLink(input.code);
  const downloadLink = `${siteUrl()}/download`;
  const expiry = input.expiresAt
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(input.expiresAt))
    : null;
  const safeCode = escapeHtml(input.code);
  const safeLink = escapeHtml(link);
  const safeDownload = escapeHtml(downloadLink);
  const label = roleLabel(input.memberRole);
  const expiryCopy = expiry
    ? `This invitation is available through ${escapeHtml(expiry)}.`
    : "This invitation does not have a scheduled expiry.";
  const welcomeHtml = input.welcomeNote
    ? `<p style="margin:20px 0 0;color:#D7D6DC;font-size:14px;line-height:1.65"><strong style="color:#7FB4FF">A note from Nikita:</strong><br>${escapeHtml(input.welcomeNote).replace(/\n/g, "<br>")}</p>`
    : "";

  // Lean transactional layout — heavy glass/gradients look promotional to filters.
  const html = `<!doctype html>
<html>
<body style="margin:0;background:#0A0A0C;color:#F2F0EB;font-family:Inter,Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0A0C;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #26262E;border-radius:12px;background:#121216">
          <tr>
            <td style="padding:28px 28px 24px">
              <div style="font-family:Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.5px">TEMPO</div>
              <p style="margin:20px 0 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8B8B96">Invitation · ${label}</p>
              <h1 style="margin:8px 0 12px;font-family:Arial,sans-serif;font-size:22px;line-height:1.3;color:#F2F0EB;font-weight:600">You’re invited to TEMPO</h1>
              <p style="margin:0;color:#B6B5BE;font-size:15px;line-height:1.6">TEMPO is a private studio for moving music from first idea through release. Download TEMPO on your computer, then create your account with the invite code below. You can also use the web app first if you prefer.</p>
              ${welcomeHtml}
              <p style="margin:22px 0 0;color:#B6B5BE;font-size:14px;line-height:1.7">When you join: introduce your artist in Origin, take a short workspace tour, follow a starter checklist at your own pace, and message Nikita whenever you need help.</p>
              <p style="margin:22px 0 0;text-align:center;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8B8B96">Your invite code</p>
              <p style="margin:8px 0 0;text-align:center;font-size:22px;font-weight:600;letter-spacing:1.5px;color:#F2F0EB">${safeCode}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 0">
                <tr>
                  <td align="center" style="border-radius:8px;background:#7FB4FF">
                    <a href="${safeDownload}" style="display:block;padding:14px 22px;color:#0A0A0C;font-size:14px;font-weight:600;text-decoration:none">Download TEMPO</a>
                  </td>
                </tr>
                <tr><td height="10" style="font-size:0;line-height:0">&nbsp;</td></tr>
                <tr>
                  <td align="center">
                    <a href="${safeLink}" style="display:block;padding:10px 22px;color:#8B8B96;font-size:13px;font-weight:500;text-decoration:underline">Use the web app</a>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 0;color:#8B8B96;font-size:12px;line-height:1.65">${expiryCopy}<br><br>If a button doesn’t work, copy one of these addresses:<br>Download: <a href="${safeDownload}" style="color:#7FB4FF;word-break:break-all">${safeDownload}</a><br>Web app: <a href="${safeLink}" style="color:#7FB4FF;word-break:break-all">${safeLink}</a></p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;color:#62626D;font-size:11px">This invitation was sent specifically to ${escapeHtml(input.email)}. Reply to this email if you have questions.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `You’re invited to TEMPO as ${label}.

TEMPO is a private studio for moving music from first idea through release. Download TEMPO on your computer, then create your account with the invite code below. You can also use the web app first if you prefer.${input.welcomeNote ? `\n\nA note from Nikita:\n${input.welcomeNote}` : ""}

When you join: introduce your artist in Origin, take a short workspace tour, follow a starter checklist at your own pace, and message Nikita whenever you need help.

Your invite code: ${input.code}

Download TEMPO: ${downloadLink}
Use the web app: ${link}

${expiryCopy}

If a button doesn’t work, copy one of the addresses above.
Reply to this email if you have questions.`;

  return { subject: "You’re invited to TEMPO", html, text, link };
}

export async function sendInviteEmail(input: InviteEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromRaw = process.env.INVITE_FROM_EMAIL;
  if (!apiKey || !fromRaw) throw new Error("Invite email delivery is not configured.");
  const from = formatFromHeader(fromRaw);
  const replyTo = resolveReplyTo(fromRaw, process.env.INVITE_REPLY_TO_EMAIL);
  const message = renderInviteEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      reply_to: replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.id !== "string") throw new Error(providerError(response.status, body));
  return { providerId: body.id as string, link: message.link };
}
