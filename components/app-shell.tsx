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
  Users,
  CircleUser,
  MoreHorizontal,
  ArrowLeft,
  Globe,
  Radio,
} from "lucide-react";
import { ScreenSourcePicker } from "@/components/sessions/screen-source-picker";
import { AssistantRoot } from "@/components/assistant/assistant-root";
import { ArtistFavicon } from "@/components/artist-favicon";
import { ArtistSwitcher } from "@/components/artist-switcher";
import { GlobalSearch } from "@/components/global-search";
import { SpaceSwitcher } from "@/components/space-switcher";
import { NotificationCenter } from "@/components/notification-center";
import { MessageCenter } from "@/components/message-center";
import { ProfileMenu } from "@/components/profile-menu";
import { IntroMoment } from "@/components/intro-moment";
import { FlareLine } from "@/components/flare-line";
import { Wordmark } from "@/components/wordmark";
import { LfWindow } from "@/components/lf-windows";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useActiveSpace } from "@/components/active-space-provider";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canRead } from "@/lib/team/areas";
import { ROLE_LABELS } from "@/lib/team/roles";
import {
  homePathForMode,
  isPathAllowedForMode,
  ownedPersonalWorkspace,
} from "@/lib/workspace-mode";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";
import { SlitDivider } from "@/components/ui/slit";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SupportReportDialog } from "@/components/support/support-report-dialog";
import { useRealtimeInbox } from "@/hooks/use-realtime-inbox";
import { useDesktopMediaWarm } from "@/hooks/use-desktop-media-warm";
import { useBrowserMediaWarm } from "@/hooks/use-browser-media-warm";
import { GlobalPlayerBar } from "@/components/player/global-player-bar";
import { CallDock } from "@/components/calls/call-dock";
import { IncomingCall } from "@/components/calls/incoming-call";
import { GuidedTour } from "@/components/guided-tour";
import { StarterChecklist } from "@/components/onboarding/starter-checklist";
import { ContextualPageTour } from "@/components/onboarding/contextual-page-tour";
import { ProTourChoice } from "@/components/onboarding/pro-tour-choice";
import { DemoBanner } from "@/components/demo/demo-banner";
import { DownloadButton } from "@/components/desktop/download-button";
import {
  flattenRailItems,
  isRailHrefActive,
  RailFlyoutScope,
  RailNavItem,
  type RailItem,
} from "@/components/rail-nav-item";
import { ZoomControl } from "@/components/desktop/zoom-control";
import { OfflineBanner } from "@/components/offline-banner";
import { TaskCategoryProvider } from "@/components/tasks/task-category-provider";
import { DesktopUpdateBanner } from "@/components/desktop/update-banner";
import { AppVideoBackdrop } from "@/components/app-video-backdrop";
import { useContentZoom } from "@/hooks/use-content-zoom";
import { useLabeledRail } from "@/hooks/use-labeled-rail";
import {
  RAIL_COMPACT_WIDTH_PX,
  RAIL_LABELED_WIDTH_PX,
  railLayoutWidthPx,
  railTypeZoom,
} from "@/lib/desktop/content-zoom";

const ARTIST_NAV_CHILDREN = [
  { href: "/artist", label: "Profile", icon: Disc3 },
  { href: "/team", label: "Team", icon: Users },
  { href: "/stats", label: "Stats", icon: BarChart3 },
] as const satisfies readonly RailItem[];

const SOCIAL_NAV_CHILDREN = [
  { href: "/social", label: "Network", icon: Globe },
  { href: "/scenes", label: "Scenes", icon: Users2 },
] as const satisfies readonly RailItem[];

// Artist sits above the space-scoped screens: it rolls up every space the
// artist owns, so it stays in the rail whatever the active space's focus is.
const MUSIC_MAIN_NAV: RailItem[] = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/board", label: "Board", icon: Columns3 },
  { href: "/tracks", label: "Tracks", icon: Music2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/sessions", label: "Sessions", icon: Radio },
  { href: "/artist", label: "Artist", icon: Disc3, children: ARTIST_NAV_CHILDREN },
  { href: "/social", label: "Social", icon: Orbit, children: SOCIAL_NAV_CHILDREN },
];

const MUSIC_MOBILE_NAV = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/board", label: "Board", icon: Columns3 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
] as const;

const TASKS_MAIN_NAV: RailItem[] = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/sessions", label: "Sessions", icon: Radio },
  { href: "/artist", label: "Artist", icon: Disc3, children: ARTIST_NAV_CHILDREN },
  { href: "/social", label: "Social", icon: Orbit, children: SOCIAL_NAV_CHILDREN },
];

const TASKS_MOBILE_NAV = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
] as const;

const WORK_MAIN_NAV: RailItem[] = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/board", label: "Board", icon: Columns3 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/sessions", label: "Sessions", icon: Radio },
  { href: "/profile", label: "Profile", icon: CircleUser },
  { href: "/team", label: "Artists", icon: Users },
  { href: "/social", label: "Social", icon: Orbit, children: SOCIAL_NAV_CHILDREN },
];

const WORK_MOBILE_NAV = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/board", label: "Board", icon: Columns3 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
] as const;

const NAV_DESCRIPTIONS: Record<string, string> = {
  "/": "See what is active, due, and ready for your attention today.",
  "/calendar": "Plan sessions, deadlines, milestones, and release dates.",
  "/sessions": "Rooms where you and your people plan, talk, and work on a song together.",
  "/board": "Move tracks and notes through the stages of your process.",
  "/tracks": "Browse and manage every track in the active space.",
  "/projects": "Organize releases, campaigns, tracks, and milestones together.",
  "/tasks": "Capture and complete work that sits outside a single track.",
  "/artist": "Shape your artist identity, story, links, and visibility.",
  "/team": "The people around this artist — or the artists you work with.",
  "/profile": "Your name, photo, and the hats you wear.",
  "/social": "Follow artists and share updates with your network.",
  "/scenes": "Join focused communities with their own conversations and events.",
  "/stats": "Read catalog activity, momentum, output, and connected signals.",
  "/settings": "Manage artists, spaces, notifications, privacy, and account options.",
};

function isActive(pathname: string, href: string) {
  return isRailHrefActive(pathname, href);
}

const FOCUS_ROUTE = /^\/track\/[^/]+\/focus(\/|$)/;

export function AppShell({ children }: { children: React.ReactNode }) {
  useRealtimeInbox();
  useDesktopMediaWarm();
  useBrowserMediaWarm();
  const { factor: contentZoom } = useContentZoom();
  const labeledRail = useLabeledRail();
  const railZoom = railTypeZoom(contentZoom, labeledRail);
  const railWidth = railLayoutWidthPx(contentZoom, labeledRail);
  const pathname = usePathname();
  const router = useRouter();
  const { activeSpace } = useActiveSpace();
  const { artists, setActiveArtistId } = useActiveArtist();
  const user = useCurrentUser();
  const { mode, areas: memberAreas, role, isLoading: modeLoading, activeArtist } =
    useWorkspaceMode();
  const tasksFocused = activeSpace?.focus === "tasks";
  // Sessions is roster-based like Scenes, not an AreaKey. Do not add /sessions here.
  const NAV_AREA: Partial<Record<string, "catalog" | "calendar" | "stats" | "social">> = {
    "/board": "catalog",
    "/tracks": "catalog",
    "/projects": "catalog",
    "/tasks": "catalog",
    "/calendar": "calendar",
    "/stats": "stats",
    "/social": "social",
  };

  const grantOk = (href: string) => {
    const area = NAV_AREA[href];
    return !area || canRead(memberAreas, area);
  };
  const filterRail = (items: RailItem[]): RailItem[] =>
    items.flatMap((item) => {
      const children = (item.children ?? []).filter((child) => grantOk(child.href));
      if (!item.children) return grantOk(item.href) ? [item] : [];
      if (!grantOk(item.href) && children.length === 0) return [];
      if (!grantOk(item.href)) {
        return [{ ...item, href: children[0].href, children }];
      }
      return [{ ...item, children }];
    });

  const artistNav = tasksFocused ? TASKS_MAIN_NAV : MUSIC_MAIN_NAV;
  const enteredNav = filterRail(artistNav);
  const mainNav =
    mode === "work" ? WORK_MAIN_NAV : mode === "entered" ? enteredNav : artistNav;
  const navDescriptions =
    mode === "work"
      ? {
          ...NAV_DESCRIPTIONS,
          "/board": "Move professional tasks through To do, In progress, and Done.",
        }
      : NAV_DESCRIPTIONS;
  const mobileNav =
    mode === "work"
      ? WORK_MOBILE_NAV
      : (tasksFocused ? TASKS_MOBILE_NAV : MUSIC_MOBILE_NAV).filter((item) =>
          mainNav.some((m) => m.href === item.href)
        );
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [topBarVisible, setTopBarVisible] = React.useState(false);
  const moreNav = [
    ...flattenRailItems(mainNav).filter(
      (item) => !mobileNav.some((m) => m.href === item.href)
    ),
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  React.useEffect(() => {
    if (modeLoading) return;
    if (isPathAllowedForMode(pathname, mode, memberAreas)) return;
    router.replace(homePathForMode(mode));
  }, [modeLoading, pathname, mode, memberAreas, router]);

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
    <div className="flex min-h-screen flex-col md:h-screen md:max-h-screen md:overflow-hidden" data-lf-chrome>
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

      <div className="flex min-h-0 flex-1">
        {/* Compact icon rail from md→lg; full labels from lg up. Width grows
            with content zoom only while labeled (so type can scale when there
            is room). Left 2px gutter stays transparent for active-nav windows. */}
        <aside
          className="sticky top-0 z-40 hidden h-screen shrink-0 flex-col overflow-visible border-r border-line md:flex"
          style={{
            width: railWidth,
            background:
              "linear-gradient(to right, transparent 2px, var(--bg-1) 2px)",
          }}
        >
          {/* Inner column is designed at compact/labeled widths; zoom scales
              type when labeled. Layout width above matches so no black gap. */}
          <div
            className="relative flex h-full min-h-0 flex-col"
            style={
              railZoom !== 1
                ? {
                    width: RAIL_LABELED_WIDTH_PX,
                    zoom: railZoom,
                  }
                : labeledRail
                  ? { width: RAIL_LABELED_WIDTH_PX }
                  : { width: RAIL_COMPACT_WIDTH_PX }
            }
          >
          {/* The rail's right border is a full-height slit onto the field, so
              the light is quietly present the whole time you're in the app. */}
          <LfWindow
            className="pointer-events-none absolute inset-y-0 right-[-1px] w-px"
            aria-hidden
          />
          <div className="overflow-hidden px-2 pt-6 pb-4 lg:px-3">
            <div className="flex min-w-0 items-center justify-center lg:justify-start">
              <Link
                href="/"
                className="min-w-0 max-w-full rounded-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <Wordmark size={22} markOnly className="lg:hidden" />
                <Wordmark
                  size={24}
                  withMark
                  className="hidden min-w-0 max-w-full lg:inline-flex"
                />
              </Link>
            </div>
            <FlareLine className="mt-3" />
          </div>

          <div className="flex flex-col gap-1.5 px-1.5 pb-4 lg:px-3">
            <ArtistSwitcher />
            <SpaceSwitcher />
          </div>

          <nav data-tour="workspace-nav" className="flex flex-1 flex-col gap-1 px-1.5 lg:px-3">
            <RailFlyoutScope>
              {mainNav.map((item) => (
                <RailNavItem
                  key={`${item.label}-${item.href}`}
                  item={item}
                  pathname={pathname}
                  descriptions={navDescriptions}
                />
              ))}
            </RailFlyoutScope>
          </nav>

          <CallDock />
          <GlobalPlayerBar />

          <SlitDivider />
          <div className="px-1.5 py-4 lg:px-3">
            <DownloadButton />
            <Link
              href="/settings"
              data-context-tour="settings"
              title={NAV_DESCRIPTIONS["/settings"]}
              aria-label="Settings"
              className={cn(
                "group relative flex items-center justify-center gap-2.5 rounded-input px-2 py-2.5 text-sm transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice lg:justify-start lg:px-3",
                isActive(pathname, "/settings")
                  ? "font-semibold text-text-hi"
                  : "font-medium text-text-lo hover:bg-bg-2/60 hover:text-text-hi"
              )}
            >
              {isActive(pathname, "/settings") ? (
                <LfWindow
                  className="absolute left-[-6px] top-1.5 bottom-1.5 w-[2px] lg:left-[-12px]"
                  aria-hidden
                />
              ) : null}
              <Settings
                className={cn(
                  "size-4 shrink-0",
                  isActive(pathname, "/settings") ? "text-ice" : "text-text-lo"
                )}
                strokeWidth={1.75}
              />
              <span className="hidden whitespace-nowrap lg:inline">Settings</span>
              <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-[90] hidden w-60 -translate-y-1/2 rounded-input border border-line bg-bg-1 px-3 py-2 text-xs leading-relaxed text-text-lo opacity-0 shadow-e3 transition-opacity delay-150 group-hover:opacity-100 group-focus-visible:opacity-100 lg:block">
                {NAV_DESCRIPTIONS["/settings"]}
              </span>
            </Link>
            <SupportReportDialog />
            <Link
              href="/beta"
              title={`v${APP_VERSION}`}
              className="mt-3 hidden rounded-input px-3 py-1 font-mono text-xs text-text-lo/70 transition-colors hover:bg-bg-2 hover:text-ice lg:block"
            >
              v{APP_VERSION}
            </Link>
          </div>
          </div>
        </aside>

        {/* Unzoomed flex column fills the remaining width (no black gap).
            Backdrop paints the full column; only the scrollable inner zooms. */}
        <main className="relative z-30 isolate min-h-0 min-w-0 flex-1 overflow-hidden">
          <AppVideoBackdrop className="pointer-events-none absolute inset-0 z-0" />
          <div
            className="relative z-[1] h-full min-h-0 overflow-x-hidden overflow-y-auto pb-20 md:pb-0"
            onScroll={(event) => {
              const nextVisible = event.currentTarget.scrollTop > 12;
              setTopBarVisible((visible) =>
                visible === nextVisible ? visible : nextVisible
              );
            }}
            style={{
              ...(contentZoom !== 1 ? { zoom: contentZoom } : {}),
              ["--tempo-content-zoom" as string]: String(contentZoom),
            }}
          >
          {/* Sticky chrome lives outside the page column so the scroll
              glass can span the whole workspace (rail edge → window edge).
              Search and the header buttons still share that column's
              right edge with the page panels. [-webkit-app-region:drag]
              also makes this row the desktop window-drag handle;
              interactive children opt out with no-drag. */}
          <div
            className="sticky top-0 z-40 isolate mb-1 [-webkit-app-region:drag]"
            data-scroll-glass={topBarVisible ? "visible" : "hidden"}
          >
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-0 inset-y-0 z-0 border-b border-line/40 bg-[linear-gradient(180deg,rgb(var(--bg-1-rgb)_/_0.42),rgb(var(--bg-1-rgb)_/_0.16))] shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-2xl backdrop-saturate-150 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                topBarVisible
                  ? "translate-y-0 opacity-100"
                  : "-translate-y-2 opacity-0"
              )}
            />
            <div className="tempo-page-col relative z-10 flex items-center justify-end gap-1.5 px-4 pb-2 pt-5 md:px-8">
              <div className="[-webkit-app-region:no-drag]">
                <NotificationCenter />
              </div>
              <div className="[-webkit-app-region:no-drag]">
                <MessageCenter />
              </div>
              <div className="[-webkit-app-region:no-drag]">
                <ProfileMenu />
              </div>
              <div
                data-tour="global-search"
                className="relative z-50 w-full max-w-[280px] [-webkit-app-region:no-drag]"
              >
                <GlobalSearch className="ml-1" />
              </div>
            </div>
          </div>
          <div className="tempo-page-col relative z-[1] px-4 md:px-8">
            {/* Above the page, not inside it: whether this catalog is real is
                context for every screen, not a fact about any one of them. */}
            <DemoBanner />
            {mode === "entered" && activeArtist ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-card border border-ice/20 bg-ice/5 px-3 py-2 text-sm">
                <p className="min-w-0 text-text-hi">
                  Working on{" "}
                  <span className="font-display">{activeArtist.name}</span>
                  {role ? ` as ${ROLE_LABELS[role]}` : ""}
                </p>
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-1.5 text-xs text-ice hover:underline"
                  onClick={() => {
                    const home = ownedPersonalWorkspace(artists, user?.id);
                    if (home) setActiveArtistId(home.id);
                    router.push("/team");
                  }}
                >
                  <ArrowLeft className="size-3.5" />
                  Back home
                </button>
              </div>
            ) : null}
            <DesktopUpdateBanner />
            <OfflineBanner />
            <div className="pb-6 pt-0">
              <TaskCategoryProvider artistId={activeArtist?.id ?? null}>
                {children}
              </TaskCategoryProvider>
            </div>
          </div>
          </div>
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40 md:hidden">
        <CallDock />
      </div>
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
          aria-label={mode === "artist" && !tasksFocused ? "Add track" : "Add task"}
          onClick={() =>
            router.push(
              mode === "work" || (mode === "artist" && !tasksFocused)
                ? "/board?new=1"
                : "/tasks"
            )
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

      <ScreenSourcePicker />
      <IncomingCall />
      <AssistantRoot />
      <ZoomControl />
      <GuidedTour />
      <ProTourChoice />
      <StarterChecklist />
      <ContextualPageTour />
    </div>
  );
}
