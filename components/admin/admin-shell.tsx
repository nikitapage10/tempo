"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  ClipboardList,
  HeartPulse,
  KeyRound,
  LifeBuoy,
  Shield,
  Users,
} from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { FlareLine } from "@/components/flare-line";
import { AppVideoBackdrop } from "@/components/app-video-backdrop";
import { ZoomControl } from "@/components/desktop/zoom-control";
import { SlitDivider } from "@/components/ui/slit";
import { useAdminOverview, useAdminSystemHealth } from "@/hooks/use-admin";
import { useContentZoom } from "@/hooks/use-content-zoom";
import { useRealtimeInbox } from "@/hooks/use-realtime-inbox";
import { summarizeSystemHealth } from "@/lib/admin/health-status";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/analytics", label: "Analytics", icon: Activity },
  { href: "/admin/users", label: "Members", icon: Users },
  { href: "/admin/invites", label: "Invites", icon: KeyRound },
  { href: "/admin/support", label: "Support", icon: LifeBuoy, attention: "support" as const },
  { href: "/admin/reports", label: "Reports", icon: Shield, attention: "reports" as const },
  { href: "/admin/system", label: "System", icon: HeartPulse, attention: "system" as const, desktopOnly: true },
  { href: "/admin/audit", label: "Audit", icon: ClipboardList },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  useRealtimeInbox(true);
  const { factor: contentZoom } = useContentZoom();
  const pathname = usePathname();
  const overview = useAdminOverview();
  const health = useAdminSystemHealth();
  const healthIssues = health.data ? summarizeSystemHealth(health.data).issues.length : 0;
  const attentionCount = (attention?: "support" | "reports" | "system") =>
    attention === "support"
      ? overview.data?.openSupportReports ?? 0
      : attention === "reports"
        ? overview.data?.openReports ?? 0
        : attention === "system"
          ? healthIssues
          : 0;
  return (
    <div className="relative isolate flex min-h-screen flex-col bg-bg-0 md:h-screen md:max-h-screen md:overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <aside className="relative z-30 hidden h-screen w-[15rem] shrink-0 flex-col overflow-hidden border-r border-line bg-bg-1 md:flex">
          <div className="shrink-0 px-5 pb-4 pt-12">
            <div className="flex items-center justify-between gap-3">
              <Wordmark size={25} />
              <span className="label-mono rounded-chip border border-amber/35 bg-amber/10 px-2 py-1 text-[10px] text-amber">
                ADMIN
              </span>
            </div>
            <FlareLine className="mt-4" />
          </div>
          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
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
                        attention === "reports" || attention === "system"
                          ? "bg-warn/15 text-warn"
                          : "bg-amber/15 text-amber"
                      )}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="shrink-0 px-3 pb-2">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-input px-3 py-2.5 text-sm text-text-lo transition-colors hover:bg-bg-2 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              <ArrowLeft className="size-4" />
              Back to TEMPO
            </Link>
          </div>
          <SlitDivider />
          <div className="shrink-0 px-5 py-4 text-[11px] text-text-lo">
            Private operations · v{APP_VERSION}
          </div>
        </aside>
        {/* Unzoomed column fills the remaining width. Backdrop paints the
            full pane; only the inner scroller zooms — same split as the studio. */}
        <main className="relative z-20 isolate min-h-0 min-w-0 flex-1 overflow-hidden">
          <AppVideoBackdrop className="pointer-events-none absolute inset-0 z-0" />
          <div
            className="relative z-[1] h-full min-h-0 overflow-x-hidden overflow-y-auto px-4 pb-24 pt-12 sm:px-6 md:px-8 md:pb-8"
            style={contentZoom !== 1 ? { zoom: contentZoom } : undefined}
          >
            <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-line bg-bg-1/85 px-4 py-3 backdrop-blur-md md:hidden">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-input px-1 py-0.5 text-sm text-text-lo transition-colors hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <ArrowLeft className="size-4" />
                Back to TEMPO
              </Link>
            </div>
            {children}
          </div>
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-line bg-bg-1/85 backdrop-blur-md md:hidden">
        {items
          .filter((item) => !item.desktopOnly)
          .map(({ href, label, icon: Icon, attention }) => {
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
      <ZoomControl placement="admin" />
    </div>
  );
}
