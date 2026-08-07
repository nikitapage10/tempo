import { ArrowUpRight, Headphones, Sparkles } from "lucide-react";
import type {
  ProfileFeaturedMusic,
  ProfileLink,
  ProfileSoundMarker,
  ProfileStorySection,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export type ArtistProfileStory = {
  bio: string | null;
  backstory: string | null;
  genres: string[];
  roles: string[];
  links: ProfileLink[];
  story_sections?: ProfileStorySection[];
  sound_markers?: ProfileSoundMarker[];
  current_focus_title?: string | null;
  current_focus_body?: string | null;
  featured_music?: ProfileFeaturedMusic[];
};

export function ArtistProfileStoryView({
  profile,
  emptyAction,
}: {
  profile: ArtistProfileStory | null;
  emptyAction?: React.ReactNode;
}) {
  const markers = profile?.sound_markers ?? [];
  const featured = (profile?.featured_music ?? []).filter((item) => isSafeWebUrl(item.url));
  const links = (profile?.links ?? []).filter((link) => isSafeWebUrl(link.url));
  const storySections = (profile?.story_sections ?? []).filter(
    (section) => section.title.trim() || section.body.trim()
  );
  const legacyStory = profile?.backstory?.trim()
    ? [{ title: "The longer arc", body: profile.backstory.trim() }]
    : [];
  const story = storySections.length ? storySections : legacyStory;
  const hasFocus = Boolean(profile?.current_focus_title || profile?.current_focus_body);
  const hasIdentity = Boolean(profile?.bio || profile?.genres.length || profile?.roles.length);
  const hasContent = Boolean(
    profile?.bio ||
      story.length ||
      markers.length ||
      featured.length ||
      hasFocus ||
      hasIdentity ||
      links.length
  );

  if (!hasContent) {
    return (
      <section className="panel-quiet relative overflow-hidden p-6 sm:p-8">
        <div aria-hidden className="absolute -right-20 -top-24 size-56 rounded-full border border-ice/10 bg-ice/[0.025]" />
        <div className="relative flex max-w-2xl flex-col gap-3">
          <div className="flex items-center gap-2 text-ice">
            <Sparkles className="size-4" strokeWidth={1.75} />
            <p className="label-mono text-ice">Waiting for a first signal</p>
          </div>
          <p className="text-sm leading-relaxed text-text-lo">
            Add an introduction, the sounds that keep returning, what is taking shape
            now, and a few pieces of music you want people to hear first.
          </p>
          {emptyAction}
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {featured.length ? (
        <section className="panel-quiet relative overflow-hidden p-6 lg:col-span-12">
          <ProfileSectionHeading kicker="Featured music" title="Start with the work" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {featured.map((item, index) => (
              <a
                key={`${item.title}-${index}`}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="group well lift relative flex min-h-28 flex-col justify-between overflow-hidden rounded-card border border-line/80 p-4"
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--ice),var(--amber),transparent)] opacity-70" />
                <div className="flex items-start justify-between gap-3">
                  <Headphones className="size-4 text-ice" strokeWidth={1.7} />
                  <ArrowUpRight className="size-4 text-text-lo transition-colors group-hover:text-ice" />
                </div>
                <div className="mt-6">
                  <h3 className="font-display text-base text-text-hi">{item.title}</h3>
                  {item.note ? <p className="mt-1 text-xs leading-relaxed text-text-lo">{item.note}</p> : null}
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {hasIdentity ? (
        <section className="panel-quiet relative overflow-hidden p-6 sm:p-7 lg:col-span-8">
          <ProfileSectionHeading kicker="About" title="Who they are and what they make" />
          {profile?.bio ? (
            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-text-hi/90">
              {profile.bio}
            </p>
          ) : null}
          {profile?.genres.length || profile?.roles.length ? (
            <div className="mt-5 flex flex-wrap gap-1.5 border-t border-line/60 pt-4">
              {profile.genres.map((genre) => (
                <span key={genre} className="rounded-chip border border-line px-2.5 py-1 text-xs text-text-lo">
                  {genre}
                </span>
              ))}
              {profile.roles.map((role) => (
                <span key={role} className="rounded-chip border border-ice/30 bg-ice/10 px-2.5 py-1 text-xs text-ice">
                  {role}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {hasFocus ? (
        <section
          className={cn(
            "panel-quiet relative overflow-hidden p-6 sm:p-7",
            hasIdentity ? "lg:col-span-4" : "lg:col-span-12"
          )}
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--amber),transparent)]" />
          <p className="label-mono text-amber">Right now</p>
          {profile?.current_focus_title ? (
            <h2 className="mt-4 font-display text-xl text-text-hi">
              {profile.current_focus_title}
            </h2>
          ) : null}
          {profile?.current_focus_body ? (
            <p className="mt-3 text-sm leading-6 text-text-lo">{profile.current_focus_body}</p>
          ) : null}
        </section>
      ) : null}

      {markers.length ? (
        <section
          className={cn(
            "panel-quiet relative overflow-hidden p-6 sm:p-7",
            links.length ? "lg:col-span-8" : "lg:col-span-12"
          )}
        >
          <ProfileSectionHeading kicker="The sound" title="What the music carries" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {markers.map((marker, index) => (
              <div
                key={`${marker.label}-${index}`}
                className="relative overflow-hidden rounded-card border border-line/70 bg-white/[0.022] p-4"
              >
                <span className="absolute right-3 top-2 text-[10px] text-ice/50">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="pr-8 font-display text-base text-text-hi">{marker.label}</h3>
                {marker.description ? (
                  <p className="mt-2 text-sm leading-6 text-text-lo">{marker.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {links.length ? (
        <section className={cn("panel-quiet p-6 sm:p-7", markers.length ? "lg:col-span-4" : "lg:col-span-12")}>
          <ProfileSectionHeading kicker="Listen and connect" title="Find the signal elsewhere" />
          <ul className="mt-5 space-y-2">
            {links.map((link, index) => (
              <li key={`${link.label}-${index}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-input border border-line/60 px-3 py-2.5 text-sm text-text-hi transition-colors hover:border-ice/40"
                >
                  <span className="truncate">{link.label}</span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-text-lo transition-colors group-hover:text-ice" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {story.length ? (
        <section className="panel-quiet overflow-hidden p-6 sm:p-7 lg:col-span-12">
          <ProfileSectionHeading kicker="The story" title="How the work arrived here" />
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {story.map((section, index) => (
              <article
                key={`${section.title}-${index}`}
                className="relative overflow-hidden rounded-card border border-line/70 bg-white/[0.022] p-5"
              >
                <span className="absolute right-4 top-3 font-mono text-[10px] text-ice/45">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.title ? (
                  <h3 className="pr-8 font-display text-lg text-text-hi">{section.title}</h3>
                ) : null}
                <p className={cn("whitespace-pre-wrap text-sm leading-7 text-text-hi/85", section.title && "mt-3")}>
                  {section.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProfileSectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="label-mono">{kicker}</p>
      <h2 className="mt-2 font-display text-xl text-text-hi">{title}</h2>
    </div>
  );
}

function isSafeWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
