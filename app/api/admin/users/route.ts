import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { memberAggregates, userProvider } from "@/lib/admin/users";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return adminError("Forbidden.", 403);
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const status = req.nextUrl.searchParams.get("status") ?? "";
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const sort = req.nextUrl.searchParams.get("sort") ?? "newest";
  try {
    const service = createAdminClient();
    const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    const aggregates = await memberAggregates(data.users.map((u) => u.id));
    let users = data.users.filter((user) => !q || (user.email ?? "").toLowerCase().includes(q) || aggregates.profiles.get(user.id)?.display_name.toLowerCase().includes(q) || aggregates.profiles.get(user.id)?.handle?.toLowerCase().includes(q));
    users = users.filter((user) => !status || (aggregates.flags.get(user.id)?.status ?? "active") === status);
    users.sort((a, b) => sort === "oldest" ? a.created_at.localeCompare(b.created_at) : sort === "email" ? (a.email ?? "").localeCompare(b.email ?? "") : b.created_at.localeCompare(a.created_at));
    const total = users.length;
    const pageUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return adminJson({ users: pageUsers.map((user) => ({ id: user.id, email: user.email ?? "", createdAt: user.created_at, lastSignInAt: user.last_sign_in_at ?? null, provider: userProvider(user), status: aggregates.flags.get(user.id)?.status ?? "active", publicProfile: aggregates.profiles.get(user.id) ?? null, trackCount: aggregates.tracks.get(user.id) ?? 0, projectCount: aggregates.projects.get(user.id) ?? 0, storageBytes: aggregates.storage.get(user.id) ?? 0 })), page, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
  } catch { return adminError("Couldn’t load members.", 500); }
}
