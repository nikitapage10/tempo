import type { MessageAttachment } from "@/lib/types";

export type SupportMessage = {
  id: string;
  report_id: string;
  sender_role: "member" | "support";
  sender_user_id: string | null;
  body: string;
  media: MessageAttachment[];
  deleted_at: string | null;
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
  member_archived_at: string | null;
  member_last_read_at: string | null;
  messages: SupportMessage[];
};

async function supportFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Support request failed.");
  return body as T;
}

export const fetchSupportThreads = (archived = false) => supportFetch<{ reports: SupportThread[] }>(`/api/support/reports?archived=${archived}`);
export const replyToSupportThread = (id: string, body: string, media: MessageAttachment[] = []) => supportFetch<{ ok: true }>(`/api/support/reports/${id}/messages`, { method: "POST", body: JSON.stringify({ body, media }) });
export const setSupportThreadState = (id: string, input: { archived?: boolean; read?: boolean }) => supportFetch<{ ok: true }>(`/api/support/reports/${id}/state`, { method: "POST", body: JSON.stringify(input) });
export const deleteSupportMessage = (id: string, messageId: string) => supportFetch<{ ok: true }>(`/api/support/reports/${id}/messages`, { method: "DELETE", body: JSON.stringify({ messageId }) });
