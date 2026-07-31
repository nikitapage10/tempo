"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, KeyRound, Shield, Users } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { FlareLine } from "@/components/flare-line";
import { SlitDivider } from "@/components/ui/slit";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/users", label: "Members", icon: Users },
  { href: "/admin/invites", label: "Invites", icon: KeyRound },
  { href: "/admin/reports", label: "Reports", icon: Shield },
  { href: "/admin/audit", label: "Audit", icon: ClipboardList },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-bg-0 md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden min-h-screen border-r border-line bg-bg-1 md:flex md:flex-col">
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-center justify-between gap-3">
            <Wordmark size={25} />
            <span className="label-mono rounded-chip border border-amber/35 bg-amber/10 px-2 py-1 text-[9px] text-amber">ADMIN</span>
          </div>
          <FlareLine className="mt-4" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-input px-3 py-2.5 text-sm transition-colors", active ? "bg-ice/10 text-ice" : "text-text-lo hover:bg-bg-2 hover:text-text-hi")}>
                <Icon className="size-4" />{label}
              </Link>
            );
          })}
        </nav>
        <SlitDivider />
        <div className="px-5 py-4 text-[10px] text-text-lo">Private operations · v{APP_VERSION}</div>
      </aside>
      <main className="min-w-0 px-4 pb-24 pt-5 sm:px-6 md:px-8 md:pb-8">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-bg-1 md:hidden">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} className={cn("flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-[10px]", active ? "text-ice" : "text-text-lo")}><Icon className="size-4"/><span className="truncate">{label}</span></Link>;
        })}
      </nav>
    </div>
  );
}
