import { formatFromHeader, resolveReplyTo } from "@/lib/admin/invite-email";
import type { RawPulseItem } from "./normalize";
import { labelForEmail } from "./normalize";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c] ?? c
  );
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mytempo.dev").replace(/\/$/, "");
}

export type DigestEmailInput = {
  kind: "daily_digest" | "weekly_digest";
  items: RawPulseItem[];
  includeEntityNames: boolean;
  manageUrl: string;
  unsubscribeUrl: string;
};

/**
 * Renders the digest email — generic wording only unless the member opted
 * into entity names (§8.5). Never includes message/comment/note bodies or
 * signed storage URLs; items only ever carry the generic/named label chosen
 * by the Pulse aggregator, never raw content.
 */
export function renderDigestEmail(input: DigestEmailInput) {
  const title = input.kind === "daily_digest" ? "Your TEMPO Pulse — today" : "Your TEMPO Pulse — this week";
  const rows = input.items
    .map((item) => {
      const label = escapeHtml(labelForEmail(item, input.includeEntityNames));
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #26262E;color:#D7D6DC;font-size:14px">${label}</td></tr>`;
    })
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#0A0A0C;color:#F2F0EB;font-family:Inter,Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0A0C;padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #26262E;border-radius:16px;background:#121216;overflow:hidden"><tr><td style="height:2px;background:linear-gradient(90deg,transparent,#7FB4FF,#F2F0EB,#FFB56B,transparent)"></td></tr><tr><td style="padding:32px"><div style="font-family:'Space Grotesk',Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:-1px">TEMPO</div><h1 style="margin:18px 0 12px;font-family:'Space Grotesk',Arial,sans-serif;font-size:24px;line-height:1.2">${title}</h1><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table><table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:24px"><tr><td style="border-radius:8px;background:#7FB4FF"><a href="${siteUrl()}" style="display:inline-block;padding:12px 20px;color:#0A0A0C;font-size:14px;font-weight:600;text-decoration:none">Open TEMPO</a></td></tr></table><p style="margin:24px 0 0;color:#62626D;font-size:11px;line-height:1.6"><a href="${escapeHtml(input.manageUrl)}" style="color:#8B8B96">Manage preferences</a> &nbsp;·&nbsp; <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#8B8B96">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>`;

  const text = [
    title,
    "",
    ...input.items.map((item) => `- ${labelForEmail(item, input.includeEntityNames)}`),
    "",
    `Open TEMPO: ${siteUrl()}`,
    `Manage preferences: ${input.manageUrl}`,
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].join("\n");

  return { subject: title, html, text };
}

export async function sendDigestEmail(input: {
  to: string;
  message: { subject: string; html: string; text: string };
  idempotencyKey: string;
}): Promise<{ providerId: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromRaw = process.env.INVITE_FROM_EMAIL; // same verified sender as invites, per plan §2.5
  if (!apiKey || !fromRaw) throw new Error("Pulse email delivery is not configured.");
  const from = formatFromHeader(fromRaw);
  const replyTo = resolveReplyTo(fromRaw, process.env.INVITE_REPLY_TO_EMAIL);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      reply_to: replyTo,
      subject: input.message.subject,
      html: input.message.html,
      text: input.message.text,
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.id !== "string") {
    const message =
      body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Resend rejected the digest (HTTP ${response.status}).`;
    const err = new Error(message) as Error & { httpStatus?: number };
    err.httpStatus = response.status;
    throw err;
  }
  return { providerId: body.id as string };
}
