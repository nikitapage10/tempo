"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actOnAdminReport, createAdminInvite, deleteAdminUser, getAdminAnalytics, getAdminAudit, getAdminInvites, getAdminOverview, getAdminReports, getAdminSupport, getAdminUser, getAdminUsers, reactivateAdminUser, revokeAdminInvite, sendAdminInvite, suspendAdminUser, updateAdminSupport } from "@/lib/api/admin";

export function useAdminOverview() { return useQuery({ queryKey: ["admin", "overview"], queryFn: getAdminOverview }); }
export function useAdminAnalytics() { return useQuery({ queryKey: ["admin", "analytics"], queryFn: getAdminAnalytics }); }
export function useAdminUsers(params: { q?: string; status?: string; page: number; sort?: string }) { return useQuery({ queryKey: ["admin", "users", params], queryFn: () => getAdminUsers(params) }); }
export function useAdminUser(id: string) { return useQuery({ queryKey: ["admin", "user", id], queryFn: () => getAdminUser(id) }); }
export function useAdminUserActions(id: string) {
  const client = useQueryClient();
  const settle = () => Promise.all([client.invalidateQueries({ queryKey: ["admin", "user", id] }), client.invalidateQueries({ queryKey: ["admin", "users"] }), client.invalidateQueries({ queryKey: ["admin", "overview"] })]);
  return { suspend: useMutation({ mutationFn: (reason: string) => suspendAdminUser(id, reason), onSettled: settle }), reactivate: useMutation({ mutationFn: () => reactivateAdminUser(id), onSettled: settle }), remove: useMutation({ mutationFn: (email: string) => deleteAdminUser(id, email), onSettled: settle }) };
}
export function useAdminInvites() {
  const client = useQueryClient(); const query = useQuery({ queryKey: ["admin", "invites"], queryFn: getAdminInvites }); const settle = () => Promise.all([client.invalidateQueries({ queryKey: ["admin", "invites"] }), client.invalidateQueries({ queryKey: ["admin", "overview"] })]);
  return { ...query, create: useMutation({ mutationFn: createAdminInvite, onSettled: settle }), revoke: useMutation({ mutationFn: revokeAdminInvite, onSettled: settle }), send: useMutation({ mutationFn: sendAdminInvite, onSettled: settle }) };
}
export function useAdminReports(status: string) { const client = useQueryClient(); const query = useQuery({ queryKey: ["admin", "reports", status], queryFn: () => getAdminReports(status) }); const act = useMutation({ mutationFn: ({ id, action }: { id: string; action: "hide" | "dismiss" | "suspend_author" }) => actOnAdminReport(id, action), onSettled: () => Promise.all([client.invalidateQueries({ queryKey: ["admin", "reports"] }), client.invalidateQueries({ queryKey: ["admin", "overview"] }), client.invalidateQueries({ queryKey: ["admin", "audit"] })]) }); return { ...query, act }; }
export function useAdminAudit(page: number) { return useQuery({ queryKey: ["admin", "audit", page], queryFn: () => getAdminAudit(page) }); }
export function useAdminSupport(status: string, archived = false) { const client = useQueryClient(); const query = useQuery({ queryKey: ["admin", "support", status, archived], queryFn: () => getAdminSupport(status, archived) }); const update = useMutation({ mutationFn: ({ id, nextStatus, ...input }: { id: string; nextStatus: "open" | "in_progress" | "resolved"; adminNotes?: string; reply?: string; media?: import("@/lib/types").MessageAttachment[]; archived?: boolean; read?: boolean; deleteMessageId?: string }) => updateAdminSupport(id, { status: nextStatus, ...input }), onSettled: () => Promise.all([client.invalidateQueries({ queryKey: ["admin", "support"] }), client.invalidateQueries({ queryKey: ["admin", "overview"] }), client.invalidateQueries({ queryKey: ["admin", "audit"] })]) }); return { ...query, update }; }
