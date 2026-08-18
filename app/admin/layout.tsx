import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin/guard";
import { CallProvider } from "@/components/calls/call-provider";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await requireAdmin();
  if (!access) redirect("/");
  return <CallProvider><AdminShell>{children}</AdminShell></CallProvider>;
}
