"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemberOnboarding } from "@/hooks/use-member-onboarding";

const TOURS: Record<string, { id: string; kicker: string; title: string; copy: string }> = {
  "/calendar": { id: "calendar", kicker: "Hold the timing", title: "Your music in time.", copy: "Deadlines, sessions, and releases meet here. Add an event or open a day to start shaping the schedule." },
  "/board": { id: "board", kicker: "Shape the pipeline", title: "Move work by momentum.", copy: "Each column is a stage in your process. Add a track, drag it forward, or edit the stages until the board sounds like your workflow." },
  "/tracks": { id: "tracks", kicker: "The catalog", title: "Every track, close at hand.", copy: "Search, sort, group, and open any track from here. A track workspace holds its bounces, notes, people, and next move." },
  "/projects": { id: "projects", kicker: "Gather the work", title: "Projects hold the bigger arc.", copy: "Use projects for releases, campaigns, or any body of work that needs tracks and tasks moving together." },
  "/tasks": { id: "tasks", kicker: "The next action", title: "Keep small moves visible.", copy: "Capture what needs doing, give it a date when timing matters, and check it off without losing the creative thread." },
  "/artist": { id: "artist", kicker: "Your identity", title: "This is how you show up.", copy: "Review the story TEMPO drafted, shape your profile, and choose whether it stays private or joins the member network." },
  "/social": { id: "social", kicker: "The network", title: "Find the people around the work.", copy: "Follow artists, share updates, and keep creative relationships connected without opening your private workspace." },
  "/scenes": { id: "scenes", kicker: "Shared rooms", title: "Step into a scene.", copy: "Scenes are focused communities with their own conversations, events, and welcome steps." },
  "/stats": { id: "stats", kicker: "Read the signal", title: "See how the work is moving.", copy: "TEMPO rolls up your catalog activity here. You can also connect platforms or create hand-tracked statistics of your own." },
  "/settings": { id: "settings", kicker: "Make it yours", title: "Your studio, your defaults.", copy: "Manage artists and spaces, notifications, imports, backups, sign-in, and privacy from one place." },
};

function tourFor(pathname: string) {
  const exact = TOURS[pathname];
  if (exact) return exact;
  return Object.entries(TOURS).find(([path]) => pathname.startsWith(`${path}/`))?.[1] ?? null;
}

export function ContextualPageTour() {
  const pathname = usePathname();
  const onboarding = useMemberOnboarding();
  const tour = tourFor(pathname);
  const [visible, setVisible] = React.useState(false);
  const [target, setTarget] = React.useState<DOMRect | null>(null);

  const seen = tour
    ? Boolean(
        onboarding.data?.pageToursCompleted.includes(tour.id) ||
        onboarding.data?.pageToursSkipped.includes(tour.id),
      )
    : true;
  const shouldOffer = Boolean(
    tour && onboarding.data?.eligible && onboarding.data.mainTourCompletedAt && !seen,
  );

  React.useEffect(() => {
    setVisible(false);
    if (!shouldOffer || !tour) return;
    const timer = window.setTimeout(() => setVisible(true), 650);
    return () => window.clearTimeout(timer);
  }, [pathname, shouldOffer, tour]);

  React.useLayoutEffect(() => {
    if (!visible || !tour) return;
    const measure = () => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-context-tour="${tour.id}"]`));
      const element = candidates.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) ?? document.querySelector<HTMLElement>("main h1");
      if (!element) return setTarget(null);
      const rect = element.getBoundingClientRect();
      setTarget(new DOMRect(rect.left - 6, rect.top - 5, rect.width + 12, rect.height + 10));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [tour, visible]);

  if (!visible || !tour) return null;

  function finish(skipped: boolean) {
    setVisible(false);
    onboarding.update.mutate(skipped ? { skippedPageTour: tour!.id } : { completedPageTour: tour!.id });
  }

  return (
    <div className="fixed inset-0 z-[54] pointer-events-none" aria-live="polite">
      {target ? (
        <div className="fixed rounded-input border border-ice/70 shadow-[0_0_0_3px_rgb(var(--ice-rgb)_/_0.12),0_0_28px_rgb(var(--ice-rgb)_/_0.24)] transition-all" style={{ left: target.left, top: target.top, width: target.width, height: target.height }} aria-hidden />
      ) : null}
      <div role="dialog" aria-label={`${tour.title} page introduction`} className="panel pointer-events-auto fixed bottom-6 left-[236px] w-[min(25rem,calc(100vw-2rem))] border-ice/30 p-5 shadow-e3 max-md:bottom-20 max-md:left-4">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-8 items-center justify-center rounded-full border border-ice/25 bg-ice/10 text-ice"><Sparkles className="size-3.5" /></span>
          <button type="button" onClick={() => finish(true)} className="rounded-input p-1.5 text-text-lo hover:bg-bg-2 hover:text-text-hi" aria-label="Skip this page introduction"><X className="size-4" /></button>
        </div>
        <p className="label-mono mt-4 text-ice">{tour.kicker}</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-text-hi">{tour.title}</h2>
        <p className="mt-2 text-sm leading-6 text-text-lo">{tour.copy}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={() => finish(true)} className="text-xs text-text-lo hover:text-text-hi">Skip</button>
          <Button type="button" size="sm" onClick={() => finish(false)}>Got it <ArrowRight /></Button>
        </div>
      </div>
    </div>
  );
}
