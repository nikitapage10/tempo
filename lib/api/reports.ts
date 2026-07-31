export type SupportCategory = "bug" | "help" | "feedback";
export type ModerationReason = "spam" | "harassment" | "hate" | "impersonation" | "inappropriate" | "other";

async function postReport(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error ?? "Couldn’t send the report.");
  return result as { ok: true; id: string };
}

export function createSupportReport(input: { category: SupportCategory; subject: string; details: string; source?: "manual" | "assistant" }) {
  const pageUrl = typeof window === "undefined" ? null : window.location.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "[id]");
  return postReport("/api/support/reports", { ...input, pageUrl, userAgent: typeof navigator === "undefined" ? null : navigator.userAgent });
}

export function createModerationReport(input: { reporterProfileId: string; targetType: "post" | "profile"; targetId: string; reason: ModerationReason; details?: string }) {
  return postReport("/api/social/report", input);
}
