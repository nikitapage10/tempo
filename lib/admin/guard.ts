import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { PLATFORM_ADMIN_COLUMNS } from "@/lib/admin/select";

export type PlatformAdmin = {
  user_id: string;
  email: string;
  granted_at: string;
  granted_by: string | null;
  note: string | null;
};

function configuredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function requireAdmin(): Promise<{
  user: User;
  admin: PlatformAdmin;
} | null> {
  const sessionClient = createServerClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user?.email) return null;

  const service = createAdminClient();
  const { data: existing } = await service
    .from("platform_admins")
    .select(PLATFORM_ADMIN_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { user, admin: existing as PlatformAdmin };

  if (!configuredAdminEmails().has(user.email.toLowerCase())) return null;
  const seeded: PlatformAdmin = {
    user_id: user.id,
    email: user.email,
    granted_at: new Date().toISOString(),
    granted_by: user.id,
    note: "Bootstrapped from ADMIN_EMAILS",
  };
  const { data, error } = await service
    .from("platform_admins")
    .upsert(seeded, { onConflict: "user_id" })
    .select(PLATFORM_ADMIN_COLUMNS)
    .single();
  if (error || !data) return null;
  return { user, admin: data as PlatformAdmin };
}
