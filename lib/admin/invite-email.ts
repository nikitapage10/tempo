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

export function inviteDeliveryConfig() {
  const from = process.env.INVITE_FROM_EMAIL?.trim() ?? "";
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  const domain = address.includes("@") ? address.split("@").at(-1) ?? null : null;
  return {
    configured: Boolean(process.env.RESEND_API_KEY?.trim() && from),
    apiKeyPresent: Boolean(process.env.RESEND_API_KEY?.trim()),
    fromPresent: Boolean(from),
    from: from || null,
    domain,
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
  if (role === "team_member") return "Pro";
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
  const isPro = input.memberRole === "team_member";
  const headline = isPro
    ? "Step into the work around the music."
    : "Bring your music into focus.";
  const introduction = isPro
    ? "TEMPO is a private workspace for the people moving music forward. It runs two ways, and both are the full thing: as an app on your Mac or PC, or in your browser. Create your account with the invite code below in whichever one you open. The desktop app is worth it if you want your workspace to open instantly and keep working offline."
    : "TEMPO is a private studio for moving music from first idea through release. It runs two ways, and both are the full thing: as an app on your Mac or PC, or in your browser. Create your account with the invite code below in whichever one you open. The desktop app is worth it if you want your workspace to open instantly, keep every bounce, and keep working offline.";
  const joinStepsHtml = isPro
    ? "01 &middot; Introduce yourself through Passage<br>02 &middot; Set up your professional home<br>03 &middot; Take a one-minute tour built for your work<br>04 &middot; Message Nikita directly whenever you need help"
    : "01 &middot; Introduce your artist through Origin<br>02 &middot; Take a one-minute workspace tour<br>03 &middot; Follow a starter checklist at your own pace<br>04 &middot; Message Nikita directly whenever you need help";
  const joinStepsText = isPro
    ? "1. Introduce yourself through Passage\n2. Set up your professional home\n3. Take a one-minute tour built for your work\n4. Message Nikita directly whenever you need help"
    : "1. Introduce your artist through Origin\n2. Take a one-minute workspace tour\n3. Follow a starter checklist at your own pace\n4. Message Nikita directly whenever you need help";
  const expiryCopy = expiry
    ? `This invitation is available through ${escapeHtml(expiry)}.`
    : "This invitation does not have a scheduled expiry.";
  const welcomeHtml = input.welcomeNote
    ? `<div style="margin:22px 0 0;padding:16px 18px;border-radius:12px;border:1px solid rgba(127,180,255,0.28);background:rgba(127,180,255,0.08);color:#D7D6DC;font-size:14px;line-height:1.65"><div style="margin-bottom:7px;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:#7FB4FF">A note from Nikita</div>${escapeHtml(input.welcomeNote).replace(/\n/g, "<br>")}</div>`
    : "";

  // Email clients can't run Spectra or real glass blur — we approximate the
  // dark glass card, flare rule, and ice CTA hierarchy from the product UI.
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
              <div style="margin-top:28px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#FFB56B">You’re invited · ${label}</div>
              <h1 style="margin:10px 0 12px;font-family:'Space Grotesk',Arial,sans-serif;font-size:30px;line-height:1.15;color:#F2F0EB">${headline}</h1>
              <p style="margin:0;color:#B6B5BE;font-size:15px;line-height:1.65">${introduction}</p>
              ${welcomeHtml}
              <div style="margin:24px 0 0;padding:18px;border:1px solid rgba(242,240,235,0.08);border-radius:14px;background:rgba(10,10,12,0.45)">
                <div style="font-size:10px;letter-spacing:1.3px;text-transform:uppercase;color:#8B8B96">What happens when you join</div>
                <div style="margin-top:12px;color:#B6B5BE;font-size:13px;line-height:1.85">${joinStepsHtml}</div>
              </div>
              <div style="margin:18px 0 0;padding:18px;border:1px solid rgba(242,240,235,0.08);border-radius:14px;background:rgba(10,10,12,0.45);text-align:center">
                <div style="font-size:10px;letter-spacing:1.3px;text-transform:uppercase;color:#8B8B96">Your invite code</div>
                <div style="margin-top:8px;font-size:22px;font-weight:600;letter-spacing:1.5px;color:#F2F0EB">${safeCode}</div>
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0 0">
                <tr>
                  <td align="center" style="border-radius:10px;background:#7FB4FF">
                    <a href="${safeDownload}" style="display:block;padding:14px 22px;color:#0A0A0C;font-size:14px;font-weight:600;text-decoration:none">Get the desktop app</a>
                  </td>
                </tr>
                <tr><td height="12" style="font-size:0;line-height:0">&nbsp;</td></tr>
                <tr>
                  <td align="center" style="border-radius:10px;border:1px solid rgba(242,240,235,0.34);background:rgba(242,240,235,0.10)">
                    <a href="${safeLink}" style="display:block;padding:14px 22px;color:#F2F0EB;font-size:14px;font-weight:600;text-decoration:none">Open TEMPO in your browser</a>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0;text-align:center;color:#8B8B96;font-size:12px;line-height:1.6">Same account either way. You can add the other one whenever you like.</p>
              <p style="margin:22px 0 0;color:#8B8B96;font-size:12px;line-height:1.65">${expiryCopy}<br><br>If a button doesn’t work, copy one of these addresses:<br>Desktop app: <a href="${safeDownload}" style="color:#7FB4FF;word-break:break-all">${safeDownload}</a><br>In your browser: <a href="${safeLink}" style="color:#7FB4FF;word-break:break-all">${safeLink}</a></p>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;color:#62626D;font-size:11px">This invitation was sent specifically to ${escapeHtml(input.email)}.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `You’re invited to TEMPO as ${label}.

${introduction.replace("the invite code below", "your invite code")}${input.welcomeNote ? `\n\nA note from Nikita:\n${input.welcomeNote}` : ""}

When you join:
${joinStepsText}

Your invite code: ${input.code}

Get the desktop app: ${downloadLink}
Open TEMPO in your browser: ${link}

Same account either way. You can add the other one whenever you like.

${expiryCopy}

If a button doesn’t work, copy one of the addresses above.`;

  return { subject: "Your invitation to TEMPO", html, text, link };
}

export async function sendInviteEmail(input: InviteEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Invite email delivery is not configured.");
  const message = renderInviteEmail(input);
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
  return { providerId: body.id as string, link: message.link };
}
