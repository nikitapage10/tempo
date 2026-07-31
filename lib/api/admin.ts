export type AdminOverview = { totalMembers: number; signupsWeek: number; signupsMonth: number; active7: number; active30: number; openReports: number; outstandingInvites: number; totalStorageBytes: number; signups: { date: string; count: number }[] };
export type AdminMember = { id: string; email: string; createdAt: string; lastSignInAt: string | null; provider: string; status: "active" | "suspended"; publicProfile: { id: string; handle: string | null; display_name: string; visibility: string } | null; trackCount: number; projectCount: number; storageBytes: number };
export type AdminUserDetail = AdminMember & { emailConfirmedAt: string | null; assistant: { messages: number; escalations: number }; invite: { code: string; redeemedAt: string } | null; accountEvents: { id: string; event_type: string; created_at: string }[] };
export type AdminInvite = { id: string; code: string; email: string | null; note: string | null; created_at: string; expires_at: string | null; max_uses: number; used_count: number; revoked_at: string | null };
export type AdminReport = { id: string; target_type: "post" | "post_comment" | "profile"; target_id: string; reason: string; details: string | null; status: string; created_at: string; target: Record<string, unknown> | null };
export type AdminAuditEntry = { id: string; admin_user_id: string | null; action: string; target_type: string; target_id: string; meta: Record<string, unknown>; created_at: string };

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Admin request failed.");
  return body as T;
}

export const getAdminOverview = () => adminFetch<AdminOverview>("/api/admin/overview");
export const getAdminUsers = (params: { q?: string; status?: string; page: number; sort?: string }) => adminFetch<{ users: AdminMember[]; page: number; totalPages: number; total: number }>(`/api/admin/users?${new URLSearchParams({ q: params.q ?? "", status: params.status ?? "", page: String(params.page), sort: params.sort ?? "newest" })}`);
export const getAdminUser = (id: string) => adminFetch<AdminUserDetail>(`/api/admin/users/${id}`);
export const suspendAdminUser = (id: string, reason: string) => adminFetch(`/api/admin/users/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) });
export const reactivateAdminUser = (id: string) => adminFetch(`/api/admin/users/${id}/reactivate`, { method: "POST", body: "{}" });
export const deleteAdminUser = (id: string, email: string) => adminFetch(`/api/admin/users/${id}`, { method: "DELETE", body: JSON.stringify({ email }) });
export const getAdminInvites = () => adminFetch<{ invites: AdminInvite[] }>("/api/admin/invites");
export const createAdminInvite = (input: { email?: string; note?: string; expiresAt?: string; maxUses?: number }) => adminFetch<{ invite: AdminInvite }>("/api/admin/invites", { method: "POST", body: JSON.stringify(input) });
export const revokeAdminInvite = (id: string) => adminFetch(`/api/admin/invites/${id}/revoke`, { method: "POST", body: "{}" });
export const getAdminReports = (status = "open") => adminFetch<{ reports: AdminReport[] }>(`/api/admin/reports?status=${encodeURIComponent(status)}`);
export const actOnAdminReport = (id: string, action: "hide" | "dismiss" | "suspend_author") => adminFetch(`/api/admin/reports/${id}`, { method: "POST", body: JSON.stringify({ action }) });
export const getAdminAudit = (page: number) => adminFetch<{ entries: AdminAuditEntry[]; page: number; totalPages: number }>(`/api/admin/audit?page=${page}`);
