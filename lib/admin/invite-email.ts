type InviteEmail = { code: string; email: string; expiresAt: string | null; idempotencyKey: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://tempo-ten-sigma.vercel.app").replace(/\/$/, "");
}

export function inviteLink(code: string) {
  return `${siteUrl()}/register?invite=${encodeURIComponent(code)}`;
}

export function inviteDeliveryConfig() {
  const from = process.env.INVITE_FROM_EMAIL?.trim() ?? "";
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  const domain = address.includes("@") ? address.split("@").at(-1) ?? null : null;
  return { configured: Boolean(process.env.RESEND_API_KEY?.trim() && from), apiKeyPresent: Boolean(process.env.RESEND_API_KEY?.trim()), fromPresent: Boolean(from), from: from || null, domain };
}

function providerError(status: number, body: unknown) {
  const result = body && typeof body === "object" ? body as { name?: unknown; message?: unknown } : null;
  const name = typeof result?.name === "string" ? result.name : "";
  const raw = typeof result?.message === "string" ? result.message.replace(/\s+/g, " ").trim().slice(0, 240) : "";
  if (name === "invalid_api_key" || status === 401) return "Resend rejected the API key. Replace RESEND_API_KEY in the production environment and redeploy.";
  if (/only send testing emails/i.test(raw)) return "Resend is still in testing mode. Verify a sending domain, then set INVITE_FROM_EMAIL to an address on that domain.";
  if (/domain.+not verified/i.test(raw)) return `${raw} Set INVITE_FROM_EMAIL to an address on a verified Resend domain.`;
  if (/from/i.test(raw) || name === "validation_error") return `Resend rejected the sender configuration: ${raw || "check INVITE_FROM_EMAIL and its verified domain."}`;
  if (status === 429) return "Resend rate-limited this request. Wait a moment, then retry.";
  return raw ? `Resend rejected the invitation: ${raw}` : `Resend rejected the invitation (HTTP ${status}).`;
}

export function renderInviteEmail(input: Omit<InviteEmail, "idempotencyKey">) {
  const link = inviteLink(input.code);
  const expiry = input.expiresAt ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(input.expiresAt)) : null;
  const safeCode = escapeHtml(input.code);
  const safeLink = escapeHtml(link);
  const expiryCopy = expiry ? `This invitation is available through ${escapeHtml(expiry)}.` : "This invitation does not have a scheduled expiry.";
  const html = `<!doctype html><html><body style="margin:0;background:#0A0A0C;color:#F2F0EB;font-family:Inter,Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0A0C;padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #26262E;border-radius:16px;background:#121216;overflow:hidden"><tr><td style="height:2px;background:linear-gradient(90deg,transparent,#7FB4FF,#F2F0EB,#FFB56B,transparent)"></td></tr><tr><td style="padding:32px"><div style="font-family:'Space Grotesk',Arial,sans-serif;font-size:25px;font-weight:700;letter-spacing:-1px">TEMPO</div><div style="margin-top:30px;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#FFB56B">You’re invited</div><h1 style="margin:10px 0 12px;font-family:'Space Grotesk',Arial,sans-serif;font-size:30px;line-height:1.15">Bring your music into focus.</h1><p style="margin:0;color:#B6B5BE;font-size:15px;line-height:1.65">TEMPO is a private workspace for moving music from first idea through release. Your individual invitation is ready.</p><div style="margin:26px 0;padding:18px;border:1px solid #26262E;border-radius:10px;background:#1A1A21;text-align:center"><div style="font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#8B8B96">Your invite code</div><div style="margin-top:8px;font-size:22px;font-weight:600;letter-spacing:1.5px;color:#F2F0EB">${safeCode}</div></div><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="border-radius:8px;background:#7FB4FF"><a href="${safeLink}" style="display:inline-block;padding:12px 20px;color:#0A0A0C;font-size:14px;font-weight:600;text-decoration:none">Create your TEMPO account</a></td></tr></table><p style="margin:22px 0 0;color:#8B8B96;font-size:12px;line-height:1.6">${expiryCopy}<br>If the button doesn’t work, copy this address:<br><a href="${safeLink}" style="color:#7FB4FF;word-break:break-all">${safeLink}</a></p></td></tr></table><p style="margin:18px 0 0;color:#62626D;font-size:11px">This invitation was sent specifically to ${escapeHtml(input.email)}.</p></td></tr></table></body></html>`;
  const text = `You’re invited to TEMPO\n\nTEMPO is a private workspace for moving music from first idea through release.\n\nYour invite code: ${input.code}\n\nCreate your account: ${link}\n\n${expiryCopy}`;
  return { subject: "Your invitation to TEMPO", html, text, link };
}

export async function sendInviteEmail(input: InviteEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Invite email delivery is not configured.");
  const message = renderInviteEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({ from, to: [input.email], subject: message.subject, html: message.html, text: message.text }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.id !== "string") throw new Error(providerError(response.status, body));
  return { providerId: body.id as string, link: message.link };
}
