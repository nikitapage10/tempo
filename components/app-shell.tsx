"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Columns3,
  FolderKanban,
  CheckSquare,
  Music2,
  Settings,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNav = [
  { href: "/", label: "Today", icon: CalendarDays },
  { href: "/board", label: "Board", icon: Columns3 },
  { href: "/tracks", label: "Tracks", icon: Music2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
] as const;

const mobileNav = [
  { href: "/", label: "Today", icon: CalendarDays },
  { href: "/board", label: "Board", icon: Columns3 },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-bg-0">
      <div className="edge-strip sticky top-0 z-50" aria-hidden />

      <div className="flex flex-1">
        {/* Desktop left rail */}
        <aside className="sticky top-[2px] hidden h-[calc(100vh-2px)] w-[220px] shrink-0 flex-col border-r border-line bg-bg-1 md:flex">
          <div className="px-5 pt-6 pb-4">
            <Link href="/" className="block">
              <span className="font-display text-xl font-bold tracking-tight text-text-hi">
                TEMPO
              </span>
            </Link>
            <div className="flare-line mt-3" />
          </div>

          {/* Space switcher placeholder */}
          <div className="px-3 pb-4">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-input border border-line bg-bg-2 px-3 py-2 text-left text-sm text-text-lo transition-colors duration-hover hover:text-text-hi"
              disabled
              title="Spaces come in the next work package"
            >
              <span>Originals</span>
              <span className="font-mono text-[11px] text-text-lo/60">▾</span>
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 px-3">
            {mainNav.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-input px-3 py-2 text-sm transition-colors duration-hover",
                    active
                      ? "bg-bg-2 text-text-hi"
                      : "text-text-lo hover:bg-bg-2/60 hover:text-text-hi"
                  )}
                >
                  <Icon
                    className={cn("size-4", active ? "text-ice" : "text-text-lo")}
                    strokeWidth={1.75}
                  />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-line px-3 py-4">
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-2.5 rounded-input px-3 py-2 text-sm transition-colors duration-hover",
                isActive(pathname, "/settings")
                  ? "bg-bg-2 text-text-hi"
                  : "text-text-lo hover:bg-bg-2/60 hover:text-text-hi"
              )}
            >
              <Settings
                className={cn(
                  "size-4",
                  isActive(pathname, "/settings") ? "text-ice" : "text-text-lo"
                )}
                strokeWidth={1.75}
              />
              Settings
            </Link>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-line bg-bg-1 md:hidden">
        {mobileNav.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px]",
                active ? "text-ice" : "text-text-lo"
              )}
            >
              <Icon className="size-5" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] text-text-lo"
          aria-label="Quick add"
          title="Quick add comes later"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-ice/15 text-ice">
            <Plus className="size-4" strokeWidth={2} />
          </span>
          Add
        </button>
      </nav>
    </div>
  );
}
