"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, LayoutDashboard, Search, Settings2, Users2 } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

export function SceneNetworkShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const items = [{ href: "/scene", label: "My Scenes", icon: Users2 }, { href: "/scene?view=discover", label: "Discover", icon: Compass }, { href: "/scene-studio", label: "Scene Studio", icon: LayoutDashboard }];
  function isItemActive(href: string) {
    const base = href.split("?")[0];
    return base === "/scene" ? pathname === "/scene" : pathname.startsWith(base);
  }
  return <div className="min-h-screen bg-bg-0 text-text-hi">
    <header className="sticky top-0 z-40 border-b border-line bg-bg-0/85 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-[1520px] items-center gap-4 px-4 sm:px-6"><Link href="/scene" className="flex items-center gap-3"><Wordmark size={24} /><span className="hidden border-l border-line pl-3 font-display text-sm font-semibold sm:block">Scenes</span></Link><div className="mx-auto hidden max-w-md flex-1 items-center gap-2 rounded-input border border-line bg-bg-1 px-3 py-2 text-xs text-text-lo md:flex"><Search className="size-4" />Search members, conversations, events</div><Link href="/" className="rounded-input border border-line px-3 py-2 text-xs text-text-lo hover:text-text-hi">Open TEMPO</Link><button type="button" aria-label="Notifications" className="rounded-input p-2 text-text-lo hover:bg-bg-2 hover:text-text-hi"><Bell className="size-4" /></button></div></header>
    <div className="mx-auto grid max-w-[1520px] md:grid-cols-[220px_minmax(0,1fr)]"><aside className="sticky top-16 hidden h-[calc(100vh-4rem)] border-r border-line p-4 md:block"><p className="label-mono px-3 py-2">Your network</p><nav className="mt-2 space-y-1">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex items-center gap-2.5 rounded-input px-3 py-2 text-sm", isItemActive(href) ? "bg-bg-2 text-ice" : "text-text-lo hover:bg-bg-2/60 hover:text-text-hi")}><Icon className="size-4" />{label}</Link>)}</nav><div className="absolute inset-x-4 bottom-5 rounded-panel border border-line bg-bg-1 p-4"><Settings2 className="size-4 text-amber" /><p className="mt-3 text-xs font-medium text-text-hi">Independent by design</p><p className="mt-1 text-xs leading-5 text-text-lo">Scenes can run without an artist workspace.</p></div></aside><main className="min-w-0 px-4 pb-24 pt-6 sm:px-6 md:pb-6 lg:px-8">{children}</main></div>
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-line bg-bg-1 md:hidden">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs", isItemActive(href) ? "text-ice" : "text-text-lo")}><Icon className="size-5" strokeWidth={1.75} />{label}</Link>)}</nav>
  </div>;
}
