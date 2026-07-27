"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Columns3,
  FolderKanban,
  CheckSquare,
  Music2,
  Settings,
  Plus,
} from "lucide-react";
import { SpaceSwitcher } from "@/components/space-switcher";
import { EdgeStrip, IntroMoment } from "@/components/intro-moment";
import { FlareLine } from "@/components/flare-line";
import { LfWindow } from "@/components/lf-windows";
import { APP_VERSION } from "@/lib/version";
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
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col" data-lf-chrome>
      <IntroMoment />
      <EdgeStrip />

      <div className="flex flex-1">
        {/* Left 2px gutter stays transparent so active-nav windows can punch through */}
        <aside
          className="sticky top-[2px] hidden h-[calc(100vh-2px)] w-[220px] shrink-0 flex-col border-r border-line md:flex"
          style={{
            background:
              "linear-gradient(to right, transparent 2px, var(--bg-1) 2px)",
          }}
        >
          <div className="px-5 pt-6 pb-4">
            <Link
              href="/"
              className="rounded-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              <span className="font-display text-xl font-bold tracking-tight text-text-hi">
                TEMPO
              </span>
            </Link>
            <FlareLine className="mt-3" />
          </div>

          <div className="px-3 pb-4">
            <SpaceSwitcher />
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 px-3">
            {mainNav.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-input px-3 py-2 text-sm transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                    active
                      ? "text-text-hi"
                      : "text-text-lo hover:bg-bg-2/60 hover:text-text-hi"
                  )}
                >
                  {active ? (
                    <LfWindow
                      className="absolute left-[-12px] top-1.5 bottom-1.5 w-[2px]"
                      aria-hidden
                    />
                  ) : null}
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
                "relative flex items-center gap-2.5 rounded-input px-3 py-2 text-sm transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                isActive(pathname, "/settings")
                  ? "text-text-hi"
                  : "text-text-lo hover:bg-bg-2/60 hover:text-text-hi"
              )}
            >
              {isActive(pathname, "/settings") ? (
                <LfWindow
                  className="absolute left-[-12px] top-1.5 bottom-1.5 w-[2px]"
                  aria-hidden
                />
              ) : null}
              <Settings
                className={cn(
                  "size-4",
                  isActive(pathname, "/settings") ? "text-ice" : "text-text-lo"
                )}
                strokeWidth={1.75}
              />
              Settings
            </Link>
            <p className="mt-3 px-3 font-mono text-[11px] text-text-lo/70">
              v{APP_VERSION}
            </p>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8">
            {children}
          </div>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-line bg-bg-1 md:hidden">
        {mobileNav.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ice",
                active ? "text-ice" : "text-text-lo"
              )}
            >
              {active ? (
                <LfWindow
                  className="absolute left-3 right-3 top-0 h-[2px]"
                  aria-hidden
                />
              ) : null}
              <Icon className="size-5" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] text-text-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ice"
          aria-label="Add track"
          onClick={() => router.push("/board?new=1")}
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
