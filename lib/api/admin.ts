import type { AdminSystemHealth } from "@/lib/admin/health-status";
export type { AdminSystemHealth };
export type AdminOverviewSupport = {
  id: string;
  email: string | null;
  category: "bug" | "help" | "feedback";
  subject: string;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  last_message_at: string | null;
};
export type AdminOverviewReport = {
  id: string;
  target_type: "post" | "post_comment" | "profile";
  reason: string;
  status: string;
  created_at: string;
};
export type AdminOverviewAudit = {
  id: string;
  action: string;
  target_type: string;
  created_at: string;
};
export type AdminOverview = {
  totalMembers: number;
  signupsWeek: number;
  signupsMonth: number;
  active7: number;
  active30: number;
  suspendedMembers: number;
  openReports: number;
  openSupportReports: number;
  outstandingInvites: number;
  totalStorageBytes: number;
  signups: { date: string; count: number }[];
  recentSupport: AdminOverviewSupport[];
  recentReports: AdminOverviewReport[];
  recentAudit: AdminOverviewAudit[];
};
export type AdminAnalytics = { totals: { aiMessages: number; aiMessages30: number; aiEscalations30: number; aiUsers30: number; storageBytes: number; storageAdded30: number; uploads30: number; focusSeconds30: number; sessions30: number; tracks30: number; projects30: number; members: number }; days: { date: string; aiMessages: number; aiEscalations: number; storageAddedBytes: number; uploads: number; focusSeconds: number }[]; tracking: { aiCostAvailable: boolean; storageIncludes: string[] } };
export type AdminActivationPulse = {
  definitionVersion: number;
  computedAt: string;
  funnel: { eligibleAccounts: number; firstTrackCreated: number | null; focusSessionStarted: number | null; focusSessionCompleted: number | null; instrumentedMilestones: string[]; pendingMilestones: string[] };
  returnRates: { d1: number; d7: number; d30: number };
  guide: { viewed: number; actioned: number; snoozed: number; hidden: number; loopCompleted: number };
  pulse: { optedIn: number; totalWithPreferences: number; sent: number; noContent: number; failed: number; suppressed: number };
};
export type AdminOnboardingSummary = { eligible: boolean; mainTourCompletedAt: string | null; checklistSteps: number; checklistDismissedAt: string | null; checklistCompletedAt: string | null; pageToursCompleted: number; welcomeMessageSentAt: string | null; lastSeenAt: string };
export type AdminMember = { id: string; email: string; createdAt: string; lastSignInAt: string | null; provider: string; status: "active" | "suspended"; memberRole: AdminInviteRole; publicProfile: { id: string; handle: string | null; display_name: string; visibility: string } | null; trackCount: number; projectCount: number; storageBytes: number; onboarding: AdminOnboardingSummary | null };
export type AdminUserDetail = AdminMember & { emailConfirmedAt: string | null; assistant: { messages: number; escalations: number }; invite: { code: string; memberRole: AdminInviteRole; redeemedAt: string } | null; accountEvents: { id: string; event_type: string; created_at: string }[] };
export type AdminInviteRole = "artist" | "team_member" | "administrator";
export type AdminInvite = { id: string; code: string; email: string | null; note: string | null; member_role: AdminInviteRole; welcome_note: string | null; created_at: string; expires_at: string | null; max_uses: number; used_count: number; revoked_at: string | null; last_sent_at: string | null; send_count: number; email_provider_id: string | null; last_send_error: string | null };
export type AdminMemberInvite = {
  id: string;
  kind: "team" | "collaborator";
  email: string | null;
  status: string;
  role: string;
  invitedByName: string;
  invitedByUserId: string;
  context: string;
  createdAt: string;
  acceptedAt: string | null;
};
export type AdminArtistInviteRequest = {
  id: string;
  email: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  requestedByName: string;
  requestedByUserId: string;
  trackTitle: string | null;
  artistName: string | null;
  createdAt: string;
  reviewedAt: string | null;
};
export type InviteDeliveryConfig = { configured: boolean; apiKeyPresent: boolean; fromPresent: boolean; from: string | null; domain: string | null };
export type AdminReport = { id: string; target_type: "post" | "post_comment" | "profile"; target_id: string; reason: string; details: string | null; status: string; created_at: string; target: Record<string, unknown> | null };
export type AdminAuditEntry = { id: string; admin_user_id: string | null; action: string; target_type: string; target_id: string; meta: Record<string, unknown>; created_at: string };
import type { MessageAttachment } from "@/lib/types";
export type AdminSupportMessage = { id: string; report_id: string; sender_role: "member" | "support"; sender_user_id: string | null; body: string; media: MessageAttachment[]; reply_to_message_id?: string | null; edited_at?: string | null; deleted_at: string | null; deleted_by_user_id?: string | null; created_at: string };
export type AdminSupportReport = { id: string; user_id: string; email: string | null; category: "bug" | "help" | "feedback"; subject: string; details: string; page_url: string | null; user_agent: string | null; source: "manual" | "assistant"; status: "open" | "in_progress" | "resolved"; admin_notes: string | null; created_at: string; updated_at: string; resolved_at: string | null; resolved_by: string | null; last_message_at: string | null; last_admin_reply_at: string | null; member_archived_at: string | null; admin_archived_at: string | null; member_last_read_at: string | null; admin_last_read_at: string | null; messages: AdminSupportMessage[] };

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Admin request failed.");
  return body as T;
}

/** True when the signed-in user can open /admin (platform_admins / ADMIN_EMAILS). */
export async function checkPlatformAdminAccess(): Promise<boolean> {
  const response = await fetch("/api/admin/access", { cache: "no-store" });
  return response.ok;
}

export const getAdminOverview = () => adminFetch<AdminOverview>("/api/admin/overview");
export const getAdminSystemHealth = () => adminFetch<AdminSystemHealth>("/api/admin/system-health");
export const getAdminAnalytics = () => adminFetch<AdminAnalytics>("/api/admin/analytics");
export const getAdminActivationPulse = () => adminFetch<AdminActivationPulse>("/api/admin/activation-pulse");
export const getAdminUsers = (params: { q?: string; status?: string; page: number; sort?: string }) => adminFetch<{ users: AdminMember[]; page: number; totalPages: number; total: number }>(`/api/admin/users?${new URLSearchParams({ q: params.q ?? "", status: params.status ?? "", page: String(params.page), sort: params.sort ?? "newest" })}`);
export const getAdminUser = (id: string) => adminFetch<AdminUserDetail>(`/api/admin/users/${id}`);
export const suspendAdminUser = (id: string, reason: string) => adminFetch(`/api/admin/users/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) });
export const reactivateAdminUser = (id: string) => adminFetch(`/api/admin/users/${id}/reactivate`, { method: "POST", body: "{}" });
export const deleteAdminUser = (id: string, email: string) => adminFetch(`/api/admin/users/${id}`, { method: "DELETE", body: JSON.stringify({ email }) });
export const updateAdminUserRole = (id: string, memberRole: AdminInviteRole) => adminFetch<{ memberRole: AdminInviteRole }>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ memberRole }) });
export const getAdminInvites = () => adminFetch<{ invites: AdminInvite[]; deliveryConfig: InviteDeliveryConfig; memberInvites: AdminMemberInvite[]; artistInviteRequests: AdminArtistInviteRequest[] }>("/api/admin/invites");
export const createAdminInvite = (input: { email?: string; note?: string; memberRole?: AdminInviteRole; welcomeNote?: string; expiresAt?: string; maxUses?: number }) => adminFetch<{ invite: AdminInvite; delivery: "sent" | "failed" | "not_requested"; deliveryError: string | null }>("/api/admin/invites", { method: "POST", body: JSON.stringify(input) });
export const revokeAdminInvite = (id: string) => adminFetch(`/api/admin/invites/${id}/revoke`, { method: "POST", body: "{}" });
export const deleteAdminInvite = (id: string) => adminFetch(`/api/admin/invites/${id}`, { method: "DELETE" });
export const sendAdminInvite = (id: string) => adminFetch<{ invite: AdminInvite }>(`/api/admin/invites/${id}/send`, { method: "POST", body: "{}" });
export const approveArtistInviteRequest = (id: string) => adminFetch<{ ok: true; delivery: "sent" | "failed" }>(`/api/admin/artist-invite-requests/${id}/approve`, { method: "POST", body: "{}" });
export const rejectArtistInviteRequest = (id: string) => adminFetch<{ ok: true }>(`/api/admin/artist-invite-requests/${id}/reject`, { method: "POST", body: "{}" });
export const getAdminReports = (status = "open") => adminFetch<{ reports: AdminReport[] }>(`/api/admin/reports?status=${encodeURIComponent(status)}`);
export const actOnAdminReport = (id: string, action: "hide" | "dismiss" | "suspend_author") => adminFetch(`/api/admin/reports/${id}`, { method: "POST", body: JSON.stringify({ action }) });
export const getAdminAudit = (page: number) => adminFetch<{ entries: AdminAuditEntry[]; page: number; totalPages: number }>(`/api/admin/audit?page=${page}`);
export const getAdminSupport = (status: string, archived = false) => adminFetch<{ reports: AdminSupportReport[] }>(`/api/admin/support?status=${encodeURIComponent(status)}&archived=${archived}`);
export const updateAdminSupport = (id: string, input: { status: AdminSupportReport["status"]; adminNotes?: string; reply?: string; media?: MessageAttachment[]; archived?: boolean; read?: boolean; deleteMessageId?: string }) => adminFetch(`/api/admin/support/${id}`, { method: "POST", body: JSON.stringify(input) });
