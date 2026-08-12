"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  ClipboardList,
  KeyRound,
  LifeBuoy,
  Shield,
  Users,
} from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { FlareLine } from "@/components/flare-line";
import { SlitDivider } from "@/components/ui/slit";
import { useAdminOverview } from "@/hooks/use-admin";
import { useRealtimeInbox } from "@/hooks/use-realtime-inbox";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/analytics", label: "Analytics", icon: Activity },
  { href: "/admin/users", label: "Members", icon: Users },
  { href: "/admin/invites", label: "Invites", icon: KeyRound },
  { href: "/admin/support", label: "Support", icon: LifeBuoy, attention: "support" as const },
  { href: "/admin/reports", label: "Reports", icon: Shield, attention: "reports" as const },
  { href: "/admin/audit", label: "Audit", icon: ClipboardList },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  useRealtimeInbox(true);
  const pathname = usePathname();
  const overview = useAdminOverview();
  const attentionCount = (attention?: "support" | "reports") =>
    attention === "support"
      ? overview.data?.openSupportReports ?? 0
      : attention === "reports"
        ? overview.data?.openReports ?? 0
        : 0;
  return (
    <div className="min-h-screen bg-bg-0 md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden min-h-screen border-r border-line bg-bg-1 md:flex md:flex-col">
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-center justify-between gap-3">
            <Wordmark size={25} />
            <span className="label-mono rounded-chip border border-amber/35 bg-amber/10 px-2 py-1 text-[10px] text-amber">
              ADMIN
            </span>
          </div>
          <FlareLine className="mt-4" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map(({ href, label, icon: Icon, attention }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            const count = attentionCount(attention);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-input px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-ice/10 text-ice" : "text-text-lo hover:bg-bg-2 hover:text-text-hi"
                )}
              >
                <Icon className="size-4" />
                <span>{label}</span>
                {count > 0 ? (
                  <span
                    aria-label={`${count} open ${label.toLowerCase()}`}
                    className={cn(
                      "ml-auto min-w-5 rounded-full px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold leading-4",
                      attention === "reports" ? "bg-warn/15 text-warn" : "bg-amber/15 text-amber"
                    )}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pb-2">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-input px-3 py-2.5 text-sm text-text-lo transition-colors hover:bg-bg-2 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
          >
            <ArrowLeft className="size-4" />
            Back to TEMPO
          </Link>
        </div>
        <SlitDivider />
        <div className="px-5 py-4 text-[11px] text-text-lo">
          Private operations · v{APP_VERSION}
        </div>
      </aside>
      <main className="min-w-0 px-4 pb-24 pt-5 sm:px-6 md:px-8 md:pb-8">
        <div className="mb-4 md:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-input border border-line bg-bg-1 px-3 py-2 text-sm text-text-lo transition-colors hover:bg-bg-2 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
          >
            <ArrowLeft className="size-4" />
            Back to TEMPO
          </Link>
        </div>
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-line bg-bg-1 md:hidden">
        {items.map(({ href, label, icon: Icon, attention }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          const count = attentionCount(attention);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-[11px]",
                active ? "text-ice" : "text-text-lo"
              )}
            >
              <span className="relative">
                <Icon className="size-4" />
                {count > 0 ? (
                  <span
                    aria-label={`${count} open ${label.toLowerCase()}`}
                    className={cn(
                      "absolute -right-3 -top-2 min-w-4 rounded-full px-1 text-center font-mono text-[9px] font-semibold leading-4",
                      attention === "reports" ? "bg-warn text-bg-0" : "bg-amber text-bg-0"
                    )}
                  >
                    {count > 9 ? "9+" : count}
                  </span>
                ) : null}
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
