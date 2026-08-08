"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  SunMedium,
  Columns3,
  FolderKanban,
  CheckSquare,
  Music2,
  Settings,
  Plus,
  Disc3,
  Orbit,
  BarChart3,
  Users2,
} from "lucide-react";
import { AssistantRoot } from "@/components/assistant/assistant-root";
import { ArtistFavicon } from "@/components/artist-favicon";
import { ArtistSwitcher } from "@/components/artist-switcher";
import { GlobalSearch } from "@/components/global-search";
import { SpaceSwitcher } from "@/components/space-switcher";
import { NotificationCenter } from "@/components/notification-center";
import { MessageCenter } from "@/components/message-center";
import { EdgeStrip, IntroMoment } from "@/components/intro-moment";
import { FlareLine } from "@/components/flare-line";
import { Wordmark } from "@/components/wordmark";
import { LfWindow } from "@/components/lf-windows";
import { useActiveSpace } from "@/components/active-space-provider";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";
import { SlitDivider } from "@/components/ui/slit";
import { SupportReportDialog } from "@/components/support/support-report-dialog";
import { useRealtimeInbox } from "@/hooks/use-realtime-inbox";
import { GlobalPlayerBar } from "@/components/player/global-player-bar";
import { GuidedTour } from "@/components/guided-tour";
import { StarterChecklist } from "@/components/onboarding/starter-checklist";
import { ContextualPageTour } from "@/components/onboarding/contextual-page-tour";

// Artist sits above the space-scoped screens: it rolls up every space the
// artist owns, so it stays in the rail whatever the active space's focus is.
const MUSIC_MAIN_NAV = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/board", label: "Board", icon: Columns3 },
  { href: "/tracks", label: "Tracks", icon: Music2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/artist", label: "Artist", icon: Disc3 },
  { href: "/social", label: "Social", icon: Orbit },
  { href: "/scenes", label: "Scenes", icon: Users2 },
  { href: "/stats", label: "Stats", icon: BarChart3 },
] as const;

const MUSIC_MOBILE_NAV = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/board", label: "Board", icon: Columns3 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
] as const;

// Tasks-focused spaces have no board or stage pipeline, so Board/Tracks
// drop out and Projects/Tasks take the front seat instead.
const TASKS_MAIN_NAV = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/artist", label: "Artist", icon: Disc3 },
  { href: "/social", label: "Social", icon: Orbit },
  { href: "/scenes", label: "Scenes", icon: Users2 },
  { href: "/stats", label: "Stats", icon: BarChart3 },
] as const;

const TASKS_MOBILE_NAV = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const FOCUS_ROUTE = /^\/track\/[^/]+\/focus(\/|$)/;

export function AppShell({ children }: { children: React.ReactNode }) {
  useRealtimeInbox();
  const pathname = usePathname();
  const router = useRouter();
  const { activeSpace } = useActiveSpace();
  const tasksFocused = activeSpace?.focus === "tasks";
  const mainNav = tasksFocused ? TASKS_MAIN_NAV : MUSIC_MAIN_NAV;
  const mobileNav = tasksFocused ? TASKS_MOBILE_NAV : MUSIC_MOBILE_NAV;

  if (FOCUS_ROUTE.test(pathname)) {
    // Focus sessions get a distraction-free, full-bleed shell — no rail, no tab bar (FEATURE-SPECS §10).
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex min-h-screen flex-col" data-lf-chrome>
      <ArtistFavicon />
      <IntroMoment />
      <EdgeStrip />

      <div className="flex flex-1">
        {/* Left 2px gutter stays transparent so active-nav windows can punch through */}
        <aside
          className="sticky top-[var(--edge-strip-h)] z-30 hidden h-[calc(100vh-var(--edge-strip-h))] w-[220px] shrink-0 flex-col border-r border-line md:flex"
          style={{
            background:
              "linear-gradient(to right, transparent 2px, var(--bg-1) 2px)",
          }}
        >
          {/* The rail's right border is a full-height slit onto the field, so
              the light is quietly present the whole time you're in the app. */}
          <LfWindow
            className="pointer-events-none absolute inset-y-0 right-[-1px] w-px"
            aria-hidden
          />
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <Wordmark size={26} />
              </Link>
            </div>
            <FlareLine className="mt-3" />
          </div>

          <div className="flex flex-col gap-1.5 px-3 pb-4">
            <ArtistSwitcher />
            <SpaceSwitcher />
          </div>

          <nav data-tour="workspace-nav" className="flex flex-1 flex-col gap-0.5 px-3">
            {mainNav.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  data-context-tour={href.slice(1) || "today"}
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

          <GlobalPlayerBar />

          <SlitDivider />
          <div className="px-3 py-4">
            <Link
              href="/settings"
              data-context-tour="settings"
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
            <SupportReportDialog />
            <Link href="/beta" className="mt-3 block rounded-input px-3 py-1 font-mono text-[11px] text-text-lo/70 transition-colors hover:bg-bg-2 hover:text-ice">
              v{APP_VERSION}
            </Link>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
            <div className="sticky top-[var(--edge-strip-h)] z-40 mb-2 flex items-center justify-end gap-1.5 bg-bg-0/85 pb-4 pt-1.5 backdrop-blur-md">
              <NotificationCenter />
              <MessageCenter />
              <div data-tour="global-search" className="w-full max-w-[280px]">
                <GlobalSearch className="ml-1" />
              </div>
            </div>
            <div className="pb-6 pt-1">{children}</div>
          </div>
        </main>
      </div>

      {/* Bottom edge — bookends the top strip so the field frames the app
          rather than only capping it. Thinner, so it reads as an echo. */}
      <LfWindow
        className="hidden h-[6px] w-full shrink-0 md:block"
        aria-hidden
      />

      <nav data-tour="workspace-nav" className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch bg-bg-1 md:hidden">
        <SlitDivider className="absolute inset-x-0 top-0" />
        {mobileNav.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              data-context-tour={href.slice(1) || "today"}
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
          aria-label={tasksFocused ? "Add task" : "Add track"}
          onClick={() =>
            router.push(tasksFocused ? "/tasks" : "/board?new=1")
          }
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-ice/15 text-ice">
            <Plus className="size-4" strokeWidth={2} />
          </span>
          Add
        </button>
      </nav>

      <AssistantRoot />
      <GuidedTour />
      <StarterChecklist />
      <ContextualPageTour />
    </div>
  );
}
