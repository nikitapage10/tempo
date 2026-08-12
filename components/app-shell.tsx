"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
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
  MoreHorizontal,
} from "lucide-react";
import { AssistantRoot } from "@/components/assistant/assistant-root";
import { ArtistFavicon } from "@/components/artist-favicon";
import { ArtistSwitcher } from "@/components/artist-switcher";
import { GlobalSearch } from "@/components/global-search";
import { SpaceSwitcher } from "@/components/space-switcher";
import { NotificationCenter } from "@/components/notification-center";
import { MessageCenter } from "@/components/message-center";
import { IntroMoment } from "@/components/intro-moment";
import { FlareLine } from "@/components/flare-line";
import { Wordmark } from "@/components/wordmark";
import { LfWindow } from "@/components/lf-windows";
import { useActiveSpace } from "@/components/active-space-provider";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";
import { SlitDivider } from "@/components/ui/slit";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SupportReportDialog } from "@/components/support/support-report-dialog";
import { useRealtimeInbox } from "@/hooks/use-realtime-inbox";
import { GlobalPlayerBar } from "@/components/player/global-player-bar";
import { GuidedTour } from "@/components/guided-tour";
import { StarterChecklist } from "@/components/onboarding/starter-checklist";
import { ContextualPageTour } from "@/components/onboarding/contextual-page-tour";
import { DemoBanner } from "@/components/demo/demo-banner";
import { DownloadButton } from "@/components/desktop/download-button";
import { ZoomControl } from "@/components/desktop/zoom-control";
import { OfflineBanner } from "@/components/offline-banner";
import { DesktopUpdateBanner } from "@/components/desktop/update-banner";
import { AppVideoBackdrop } from "@/components/app-video-backdrop";

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

const NAV_DESCRIPTIONS: Record<string, string> = {
  "/": "See what is active, due, and ready for your attention today.",
  "/calendar": "Plan sessions, deadlines, milestones, and release dates.",
  "/board": "Move tracks and notes through the stages of your process.",
  "/tracks": "Browse and manage every track in the active space.",
  "/projects": "Organize releases, campaigns, tracks, and milestones together.",
  "/tasks": "Capture and complete work that sits outside a single track.",
  "/artist": "Shape your artist identity, story, links, and visibility.",
  "/social": "Follow artists and share updates with your network.",
  "/scenes": "Join focused communities with their own conversations and events.",
  "/stats": "Read catalog activity, momentum, output, and connected signals.",
  "/settings": "Manage artists, spaces, notifications, privacy, and account options.",
};

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
  const [moreOpen, setMoreOpen] = React.useState(false);
  // Everything the rail can reach that the 4-slot mobile tab bar can't —
  // otherwise Tracks, Projects, Artist, Social, Scenes, Stats, and Settings
  // are unreachable on a phone.
  const moreNav = [
    ...mainNav.filter((item) => !mobileNav.some((m) => m.href === item.href)),
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  if (FOCUS_ROUTE.test(pathname)) {
    // Focus sessions keep the persistent workspace backdrop but remain
    // distraction-free: no rail, toolbar, tab bar, or edge treatment.
    return (
      <main className="relative isolate min-h-screen">
        <AppVideoBackdrop className="fixed inset-0 z-0" />
        <div className="relative z-[1]">{children}</div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" data-lf-chrome>
      <ArtistFavicon />
      <IntroMoment />

      {/* Desktop-app window-drag handle for empty top gutters. Kept below the
          rail and main stacking contexts (z-10) so it can never eat clicks on
          search / notifications — those live in main at z-30. No-op outside
          Electron. */}
      <div
        aria-hidden
        className="pointer-events-auto fixed inset-x-0 top-0 z-10 h-12 [-webkit-app-region:drag]"
      />

      <div className="flex flex-1">
        {/* Left 2px gutter stays transparent so active-nav windows can punch through */}
        <aside
          className="sticky top-0 z-30 hidden h-screen w-[220px] shrink-0 flex-col border-r border-line md:flex"
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
                  title={NAV_DESCRIPTIONS[href]}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-input px-3 py-2 text-sm transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                    active
                      ? "font-semibold text-text-hi"
                      : "font-medium text-text-lo hover:bg-bg-2/60 hover:text-text-hi"
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
                  <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-[90] w-60 -translate-y-1/2 rounded-input border border-line bg-bg-1 px-3 py-2 text-xs leading-relaxed text-text-lo opacity-0 shadow-e3 transition-opacity delay-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                    {NAV_DESCRIPTIONS[href]}
                  </span>
                </Link>
              );
            })}
          </nav>

          <GlobalPlayerBar />

          <SlitDivider />
          <div className="px-3 py-4">
            <DownloadButton />
            <Link
              href="/settings"
              data-context-tour="settings"
              title={NAV_DESCRIPTIONS["/settings"]}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-input px-3 py-2 text-sm transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                isActive(pathname, "/settings")
                  ? "font-semibold text-text-hi"
                  : "font-medium text-text-lo hover:bg-bg-2/60 hover:text-text-hi"
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
              <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-[90] w-60 -translate-y-1/2 rounded-input border border-line bg-bg-1 px-3 py-2 text-xs leading-relaxed text-text-lo opacity-0 shadow-e3 transition-opacity delay-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                {NAV_DESCRIPTIONS["/settings"]}
              </span>
            </Link>
            <SupportReportDialog />
            <Link href="/beta" className="mt-3 block rounded-input px-3 py-1 font-mono text-xs text-text-lo/70 transition-colors hover:bg-bg-2 hover:text-ice">
              v{APP_VERSION}
            </Link>
          </div>
        </aside>

        {/* z-30 keeps this stacking context above the desktop drag strip so
            search and notification hit targets stay clickable. */}
        <main className="relative z-30 isolate flex-1 overflow-x-hidden pb-20 md:pb-0">
          <AppVideoBackdrop className="fixed inset-x-0 bottom-0 top-0 z-0 md:bottom-[6px] md:left-[220px]" />
          <div className="relative z-[1] mx-auto w-full max-w-[1440px] px-4 md:px-8">
            {/* [-webkit-app-region:drag] makes this row double as the desktop
                app's window-drag handle (a no-op outside Electron, so it's
                safe unconditionally) — each interactive child below is
                explicitly carved out with the matching no-drag utility so
                clicks still reach them instead of moving the window.
                Extra top padding clears the window edge; tighter bottom
                padding pulls the chrome closer to page content. */}
            <div className="sticky top-0 z-40 mb-1 flex items-center justify-end gap-1.5 pb-2 pt-5 [-webkit-app-region:drag]">
              <div className="[-webkit-app-region:no-drag]">
                <NotificationCenter />
              </div>
              <div className="[-webkit-app-region:no-drag]">
                <MessageCenter />
              </div>
              <div
                data-tour="global-search"
                className="relative z-50 w-full max-w-[280px] [-webkit-app-region:no-drag]"
              >
                <GlobalSearch className="ml-1" />
              </div>
            </div>
            {/* Above the page, not inside it: whether this catalog is real is
                context for every screen, not a fact about any one of them. */}
            <DemoBanner />
            <DesktopUpdateBanner />
            <OfflineBanner />
            <div className="pb-6 pt-0">{children}</div>
          </div>
        </main>
      </div>

      {/* A restrained bottom-edge echo; the former top shader strip is gone. */}
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
                "relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ice",
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
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ice",
            moreOpen || moreNav.some((item) => isActive(pathname, item.href))
              ? "text-ice"
              : "text-text-lo"
          )}
          aria-haspopup="true"
          aria-expanded={moreOpen}
          aria-label="More"
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal className="size-5" strokeWidth={1.75} />
          More
        </button>
        <button
          type="button"
          className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs text-text-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ice"
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

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent title="More" onClose={() => setMoreOpen(false)}>
          <nav className="grid grid-cols-3 gap-2">
            {moreNav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-input border px-2 py-3 text-center text-xs",
                  isActive(pathname, href)
                    ? "border-ice/40 bg-ice/10 text-ice"
                    : "border-line bg-bg-2/40 text-text-lo hover:text-text-hi"
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
                {label}
              </Link>
            ))}
          </nav>
        </DialogContent>
      </Dialog>

      <AssistantRoot />
      <ZoomControl />
      <GuidedTour />
      <StarterChecklist />
      <ContextualPageTour />
    </div>
  );
}
