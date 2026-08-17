"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemberOnboarding } from "@/hooks/use-member-onboarding";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { cn } from "@/lib/utils";

type TourStep = {
  selector: string;
  matchIndex?: number;
  kicker: string;
  title: string;
  copy: string;
};

type PageTour = { id: string; steps: TourStep[] };
type Point = { top: number; left: number };

const pageStep = (kicker: string, title: string, copy: string): TourStep => ({
  selector: "main header, main h1",
  kicker,
  title,
  copy,
});

const TOURS: Record<string, PageTour> = {
  "/calendar": {
    id: "calendar",
    steps: [
      pageStep("Hold the timing", "Your music in time.", "Deadlines, sessions, releases, and milestones meet here. Month, Week, Agenda, and Timeline cover it from every angle, with Filters and More tucked out of the way until you need them."),
      { selector: 'main [aria-label="Quick schedule with AI"]', kicker: "Just say it", title: "Type it, or speak it.", copy: "“Studio session Friday at 7pm” becomes a real event — tap the microphone to dictate instead of typing. Start with “task:” to add a task instead." },
      { selector: 'main [aria-label="Creative timeline"], main [role="grid"], main .glass', kicker: "See the whole arc", title: "Plan visually.", copy: "Use the timeline, month grid, or the new hour-by-hour Week view to see where creative work, deadlines, and releases overlap." },
      { selector: 'main [aria-label="Upcoming schedule"], main .glass-quiet', kicker: "What is next", title: "Keep the near future close.", copy: "The schedule view collects upcoming work so the next commitment never gets buried." },
    ],
  },
  "/board": {
    id: "board",
    steps: [
      pageStep("Shape the pipeline", "Move work by momentum.", "The board turns your process into stages. Use the top controls to sort, filter, edit stages, or add a track."),
      { selector: 'main [class*="lg:flex-row"], main .panel, main .panel-quiet', kicker: "Your stages", title: "See the whole process.", copy: "Each column represents a stage. Drag tracks forward as they develop, and keep notes beside the work they belong to." },
    ],
  },
  "/tracks": {
    id: "tracks",
    steps: [
      pageStep("The catalog", "Every track, close at hand.", "Search, sort, group, and filter the catalog from the controls at the top. Add a track whenever an idea is ready to become real."),
      { selector: 'main [role="group"][aria-label="List density"], main .panel, main .panel-quiet', kicker: "Choose the view", title: "Make the catalog readable.", copy: "Change the density, grouping, and order to match how you want to scan the work today." },
      { selector: 'main article, main a[href^="/track/"], main .panel', kicker: "Open the work", title: "Each track has its own room.", copy: "Open any track to find its bounces, notes, collaborators, details, and next move together." },
    ],
  },
  "/projects": {
    id: "projects",
    steps: [
      pageStep("Gather the work", "Projects hold the bigger arc.", "Use projects for releases, campaigns, or any body of work that needs tracks and tasks moving together."),
      { selector: 'main a[href^="/projects/"], main .panel, main [class*="grid"]', kicker: "Project rooms", title: "Keep the release together.", copy: "Open a project to manage its tracks, milestones, notes, links, and release plan in one place." },
    ],
  },
  "/tasks": {
    id: "tasks",
    steps: [
      pageStep("The next action", "Keep small moves visible.", "Tasks hold the work that does not belong inside a single track, including pitching, social, and admin."),
      { selector: "main form", kicker: "Capture it quickly", title: "Get it out of your head.", copy: "Type the next action here, choose a category, and add more detail only when it helps." },
      { selector: "main section, main .panel-quiet", kicker: "Work the list", title: "Focus on what matters now.", copy: "Use the views below to find overdue work, upcoming tasks, and completed progress without losing the creative thread." },
    ],
  },
  "/artist": {
    id: "artist",
    steps: [
      pageStep("Your identity", "This is how you show up.", "This profile carries your artist story, visual identity, and the context people see when they connect with you."),
      { selector: "#profile-visibility", kicker: "You control the door", title: "Private until you say otherwise.", copy: "Choose whether your profile stays private, appears to TEMPO members, or has a public link." },
      { selector: "main .panel-quiet", kicker: "Shape the story", title: "Make the profile sound like you.", copy: "Review what TEMPO drafted, then edit the story, roles, genres, links, and other details whenever they evolve." },
    ],
  },
  "/social": {
    id: "social",
    steps: [
      pageStep("The network", "Find the people around the work.", "Social is separate from your private workspace. Join when you want other artists to discover and follow you."),
      { selector: "main textarea, main .panel", kicker: "Share the signal", title: "Post without leaving the work behind.", copy: "Share an update, follow artists, and keep creative relationships moving in the same place." },
      { selector: "main aside, main .panel-quiet", matchIndex: 1, kicker: "Your circle", title: "Keep collaborators nearby.", copy: "The people and activity around your network stay visible alongside the main feed." },
    ],
  },
  "/scenes": {
    id: "scenes",
    steps: [
      pageStep("Shared rooms", "Step into a scene.", "Scenes are focused communities with their own people, conversations, events, and welcome steps."),
      { selector: 'main a[href="/scenes/new"], main [class*="flex-wrap"]', kicker: "Find your rooms", title: "Browse or start a scene.", copy: "Use the tabs to move between your scenes and discovery, or create a room for a community you already know." },
      { selector: 'main a[href^="/scenes/"], main .panel-quiet', matchIndex: 1, kicker: "Inside a scene", title: "Each community has its own rhythm.", copy: "Open a scene to see its feed, events, members, chat, and any onboarding steps from its hosts." },
    ],
  },
  "/stats": {
    id: "stats",
    steps: [
      pageStep("Read the signal", "See how the work is moving.", "The opening summary rolls up tracks, bounces, progress, releases, and focus time across this artist."),
      { selector: "main section, main .panel", kicker: "Arrange the readout", title: "Your useful numbers, your way.", copy: "The modules below reveal output, momentum, catalog patterns, and work rhythm. Rearrange them to keep the most useful signals first." },
      { selector: "main section, main .panel-quiet", matchIndex: 1, kicker: "Bring in context", title: "Connect or track what matters.", copy: "Platform connections and custom statistics let you add signals TEMPO cannot infer from the catalog alone." },
    ],
  },
  "/settings": {
    id: "settings",
    steps: [
      pageStep("Make it yours", "Your studio, your defaults.", "Settings brings artists, spaces, notifications, imports, backups, sign-in, and privacy into one place."),
      { selector: 'main [role="tablist"]', kicker: "Move by category", title: "Everything has a home.", copy: "Use these categories to jump directly to the part of TEMPO you want to adjust." },
      { selector: 'main [role="tabpanel"]', kicker: "Change with confidence", title: "The active settings live here.", copy: "Each category keeps related controls together, with explanations beside choices that affect your workspace or privacy." },
    ],
  },
};

/**
 * The Pro set, for the pages a Pro's rail actually has.
 *
 * Deliberately a separate map rather than reworded shared steps. Half of the
 * artist tour treats Board as a song pipeline and also points at Tracks,
 * Stats, and the artist identity editor. Pro has its own workflow Board, and
 * the pages both shells share are still described
 * from the wrong side: a manager opening Calendar is not looking at "your
 * music in time", they are looking at other people's.
 *
 * The ids carry a `pro-` prefix so taking one set never marks the other seen.
 * A dual account (a Pro who later becomes an artist) gets both, in the shell
 * that applies at the time.
 */
const PRO_TOURS: Record<string, PageTour> = {
  "/": {
    id: "pro-today",
    steps: [
      pageStep("Where the day starts", "Everything waiting on you.", "Today gathers what is due, what is moving, and what the artists you work with have been up to, across every workspace you have access to."),
      { selector: "main [data-tour='pro-today-hub']", kicker: "Across the roster", title: "One view, not one artist.", copy: "Open tasks and projects are yours. Below them, waiting work and the artists you work with sit together so nothing stays buried in a room you did not open today." },
    ],
  },
  "/calendar": {
    id: "pro-calendar",
    steps: [
      pageStep("Hold the timing", "The schedule you are keeping.", "Sessions, deadlines, releases, and shows for the people you support. Month, Week, Agenda, and Timeline each answer a different question about the same dates."),
      { selector: 'main [aria-label="Quick schedule with AI"]', kicker: "Just say it", title: "Type it, or speak it.", copy: "“Mix review Friday at 7pm” becomes a real event. Tap the microphone to dictate instead of typing, or start with “task:” to capture an action instead." },
      { selector: 'main [aria-label="Creative timeline"], main [role="grid"], main .glass', kicker: "See the whole arc", title: "Spot the collisions early.", copy: "The timeline and month grid make overlapping deadlines, travel, and release dates visible before they become a problem." },
    ],
  },
  "/board": {
    id: "pro-board",
    steps: [
      pageStep("Shape the flow", "Move work, not songs.", "This board turns the tasks in your current Pro Space into a simple flow: To do, In progress, and Done. It is separate from every artist's song pipeline."),
      { selector: "main [data-pro-board]", kicker: "One shared state", title: "Drag the work forward.", copy: "Move a card between columns as its status changes. The same update appears on Tasks, so the board and list never drift apart." },
    ],
  },
  "/projects": {
    id: "pro-projects",
    steps: [
      pageStep("Gather the work", "Projects hold the bigger arc.", "Releases, campaigns, and any body of work with more than one moving part. This is usually where your day actually lives."),
      { selector: 'main a[href^="/projects/"], main .panel, main [class*="grid"]', kicker: "Project rooms", title: "Keep the release together.", copy: "Open a project for its tracks, milestones, notes, links, and plan. Everyone with access sees the same state, so status meetings get shorter." },
    ],
  },
  "/tasks": {
    id: "pro-tasks",
    steps: [
      pageStep("The next action", "The work between the work.", "Pitching, admin, travel, follow-ups, and everything that does not belong inside a single song."),
      { selector: "main form", kicker: "Capture it quickly", title: "Get it out of your head.", copy: "Type the next action, pick a category, and add detail only when it helps. Anything you capture here is visible to the people you share the workspace with." },
      { selector: "main section, main .panel-quiet", kicker: "Work the list", title: "Find what is actually overdue.", copy: "The views below separate overdue, upcoming, and done, so a long list stays workable." },
    ],
  },
  "/team": {
    id: "pro-team",
    steps: [
      pageStep("Who you work with", "Every artist, in one place.", "The artists whose workspaces you have been given access to, with what is overdue, what is coming, and how big the catalog is."),
      { selector: 'main a[href^="/artist/"], main .panel, main .panel-quiet', kicker: "Step inside", title: "Enter a workspace.", copy: "Opening an artist puts you in their room with exactly the areas they granted you. Their catalog, calendar, and releases, none of your own." },
    ],
  },
  "/profile": {
    id: "pro-profile",
    steps: [
      pageStep("How you show up", "Your own presence.", "The name, photo, and story you gave in Passage live here. This is what artists you work with and people on Social see."),
      { selector: "main .panel-quiet, main .panel", kicker: "Yours to change", title: "Nothing here is fixed.", copy: "Edit any of it whenever it stops being true. This is a professional profile, not an artist page: it never implies you make the music." },
    ],
  },
  "/social": {
    id: "pro-social",
    steps: [
      pageStep("The network", "The people around the work.", "Social is separate from the workspaces you have access to. Join it when you want to be findable by the artists and industry people you do not already know."),
      { selector: "main textarea, main .panel", kicker: "Post as yourself", title: "You post as you.", copy: "Anything you share here goes out under your own name, never as one of the artists you work with." },
    ],
  },
  "/scenes": {
    id: "pro-scenes",
    steps: [
      pageStep("Shared rooms", "Step into a scene.", "Scenes are focused communities with their own people, conversations, and events. Labels, collectives, and local circles tend to live here."),
      { selector: 'main a[href="/scenes/new"], main [class*="flex-wrap"]', kicker: "Find your rooms", title: "Browse or start one.", copy: "Move between the scenes you are in and the ones you could join, or open a room for a community you already run." },
    ],
  },
  "/settings": {
    id: "pro-settings",
    steps: [
      pageStep("Make it yours", "Your account, your defaults.", "Your name and photo, notifications, sign-in, and privacy in one place."),
      { selector: 'main [role="tablist"]', kicker: "Move by category", title: "Everything has a home.", copy: "Jump straight to the part you want to change." },
      { selector: 'main [role="tabpanel"]', kicker: "Change with confidence", title: "Look lives here.", copy: "Colors, photo, logo, and banner for your own space, the same ones you set during Passage." },
    ],
  },
};

function tourFor(pathname: string, pro: boolean) {
  const source = pro ? PRO_TOURS : TOURS;
  const exact = source[pathname];
  if (exact) return exact;
  // "/" must not prefix-match every route, so only real segments are walked.
  return (
    Object.entries(source).find(
      ([path]) => path !== "/" && pathname.startsWith(`${path}/`)
    )?.[1] ?? null
  );
}

function visibleTarget(step: TourStep): HTMLElement | null {
  const matches = Array.from(document.querySelectorAll<HTMLElement>(step.selector)).filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
  });
  return matches[step.matchIndex ?? 0] ?? matches[0] ?? document.querySelector<HTMLElement>("main");
}

function paddedRect(element: HTMLElement): DOMRect {
  const source = element.getBoundingClientRect();
  const pad = source.width < 80 || source.height < 60 ? 10 : 8;
  const left = Math.max(8, source.left - pad);
  const top = Math.max(8, source.top - pad);
  const right = Math.min(window.innerWidth - 8, source.right + pad);
  const bottom = Math.min(window.innerHeight - 8, source.bottom + pad);
  return new DOMRect(left, top, right - left, bottom - top);
}

export function ContextualPageTour() {
  const pathname = usePathname();
  const onboarding = useMemberOnboarding();
  const { mode } = useWorkspaceMode();
  const isPro = mode === "work";
  const tour = tourFor(pathname, isPro);
  const [visible, setVisible] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);
  const [panelPoint, setPanelPoint] = React.useState<Point>({ top: 24, left: 24 });
  const panelRef = React.useRef<HTMLDivElement>(null);

  const seen = tour
    ? Boolean(onboarding.data?.pageToursCompleted.includes(tour.id) || onboarding.data?.pageToursSkipped.includes(tour.id))
    : true;
  /** Artist and Pro decisions are deliberately separate. A dual account can
   * finish Origin without silently opting into professional page guides. */
  const introDone = isPro
    ? onboarding.data?.proTourChoice === "guides"
    : Boolean(onboarding.data?.mainTourCompletedAt);
  const shouldOffer = Boolean(tour && onboarding.data?.eligible && introDone && !seen);

  React.useEffect(() => {
    setVisible(false);
    setStepIndex(0);
    if (!shouldOffer || !tour) return;
    const timer = window.setTimeout(() => setVisible(true), 650);
    return () => window.clearTimeout(timer);
  }, [pathname, shouldOffer, tour]);

  const step = tour?.steps[stepIndex];
  const measure = React.useCallback(() => {
    if (!visible || !step) return;
    const target = visibleTarget(step);
    setTargetRect(target ? paddedRect(target) : null);
  }, [step, visible]);

  React.useLayoutEffect(() => {
    if (!visible || !step) return;
    const target = visibleTarget(step);
    target?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    measure();
    const settleTimer = window.setTimeout(measure, 360);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure, step, visible]);

  React.useLayoutEffect(() => {
    if (!visible) return;
    const panel = panelRef.current;
    if (!panel) return;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const margin = 16;
    const gap = 18;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    if (!targetRect) {
      setPanelPoint({ left: Math.max(margin, (window.innerWidth - width) / 2), top: Math.max(margin, (window.innerHeight - height) / 2) });
      return;
    }
    const roomRight = window.innerWidth - targetRect.right;
    const roomBelow = window.innerHeight - targetRect.bottom;
    const roomAbove = targetRect.top;
    let left = Math.min(maxLeft, Math.max(margin, targetRect.left));
    let top = Math.min(maxTop, Math.max(margin, targetRect.bottom + gap));
    if (roomRight >= width + gap) {
      left = targetRect.right + gap;
      top = Math.min(maxTop, Math.max(margin, targetRect.top));
    } else if (roomBelow >= height + gap) {
      top = targetRect.bottom + gap;
    } else if (roomAbove >= height + gap) {
      top = targetRect.top - height - gap;
    } else {
      top = maxTop;
    }
    setPanelPoint({ left, top });
  }, [stepIndex, targetRect, visible]);

  React.useEffect(() => {
    if (!visible) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish(true);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", onKey);
    };
    // `finish` only closes this mounted tour and records its stable id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible || !tour || !step) return null;

  function finish(skipped: boolean) {
    setVisible(false);
    onboarding.update.mutate(skipped ? { skippedPageTour: tour!.id } : { completedPageTour: tour!.id });
  }

  const isLast = stepIndex === tour.steps.length - 1;

  return (
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-labelledby="contextual-tour-title">
      <div className="absolute inset-0" aria-hidden />
      {targetRect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[14px] border border-ice/70 shadow-[0_0_0_9999px_rgb(5_5_8_/_0.78),0_0_0_3px_rgb(var(--ice-rgb)_/_0.12),0_0_32px_rgb(var(--ice-rgb)_/_0.3)] transition-[left,top,width,height] duration-300 motion-reduce:transition-none"
          style={{ left: targetRect.left, top: targetRect.top, width: targetRect.width, height: targetRect.height }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-bg-0/80" />
      )}

      <div
        ref={panelRef}
        className={cn("panel fixed w-[min(360px,calc(100vw-32px))] p-5 shadow-raise transition-[left,top] duration-300 motion-reduce:transition-none", !targetRect && "border-ice/30")}
        style={{ left: panelPoint.left, top: panelPoint.top }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="flex size-8 items-center justify-center rounded-full border border-ice/25 bg-ice/10 text-ice"><Sparkles className="size-3.5" /></span>
            <p className="label-mono mt-3 text-ice">{step.kicker}</p>
            <p className="mt-2 font-mono text-xs tabular-nums text-text-lo">{String(stepIndex + 1).padStart(2, "0")} / {String(tour.steps.length).padStart(2, "0")}</p>
          </div>
          <button type="button" onClick={() => finish(true)} className="rounded-input p-1.5 text-text-lo transition-colors hover:bg-bg-2 hover:text-text-hi" aria-label="Skip this page tour"><X className="size-4" /></button>
        </div>
        <h2 id="contextual-tour-title" className="mt-4 font-display text-xl font-semibold tracking-tight text-text-hi">{step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-text-lo">{step.copy}</p>
        <div className="mt-5 h-px w-full bg-[linear-gradient(90deg,var(--ice),white,var(--amber),transparent)] opacity-40" />
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => finish(true)} className="text-xs text-text-lo hover:text-text-hi">Skip tour</button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 ? <Button type="button" size="sm" variant="ghost" onClick={() => setStepIndex((value) => value - 1)}>Back</Button> : null}
            <Button type="button" size="sm" onClick={() => { if (isLast) finish(false); else setStepIndex((value) => value + 1); }}>
              {isLast ? <>Done <Check /></> : <>Next <ArrowRight /></>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
