export type SupportMessage = {
  id: string;
  report_id: string;
  sender_role: "member" | "support";
  sender_user_id: string | null;
  body: string;
  created_at: string;
};

export type SupportThread = {
  id: string;
  category: "bug" | "help" | "feedback";
  subject: string;
  details: string;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_admin_reply_at: string | null;
  messages: SupportMessage[];
};

async function supportFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Support request failed.");
  return body as T;
}

export const fetchSupportThreads = () => supportFetch<{ reports: SupportThread[] }>("/api/support/reports");
export const replyToSupportThread = (id: string, body: string) => supportFetch<{ ok: true }>(`/api/support/reports/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) });
