import { ArrowUpRight, Headphones, Sparkles } from "lucide-react";
import type {
  ProfileFeaturedMusic,
  ProfileLink,
  ProfileSoundMarker,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export type ArtistProfileStory = {
  bio: string | null;
  backstory: string | null;
  genres: string[];
  roles: string[];
  links: ProfileLink[];
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
  const hasFocus = Boolean(profile?.current_focus_title || profile?.current_focus_body);
  const hasDetails = Boolean(profile?.genres.length || profile?.roles.length || links.length);
  const hasContent = Boolean(
    profile?.bio ||
      profile?.backstory ||
      markers.length ||
      featured.length ||
      hasFocus ||
      hasDetails
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

      {profile?.bio ? (
        <section className="panel-quiet relative overflow-hidden p-6 sm:p-7 lg:col-span-8">
          <ProfileSectionHeading kicker="About" title="The work, in focus" />
          <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-text-hi/90">
            {profile.bio}
          </p>
        </section>
      ) : null}

      {hasFocus ? (
        <section
          className={cn(
            "panel-quiet relative overflow-hidden p-6 sm:p-7",
            profile?.bio ? "lg:col-span-4" : "lg:col-span-12"
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
        <section className="panel-quiet relative overflow-hidden p-6 sm:p-7 lg:col-span-8">
          <ProfileSectionHeading kicker="The spectrum" title="What keeps returning" />
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

      {hasDetails ? (
        <section
          className={cn(
            "panel-quiet p-6 sm:p-7",
            markers.length ? "lg:col-span-4" : "lg:col-span-12"
          )}
        >
          <ProfileSectionHeading kicker="Details" title="Where to place the signal" />

          {profile?.genres.length || profile?.roles.length ? (
            <div className="mt-5 flex flex-wrap gap-1.5">
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

          {links.length ? (
            <ul className="mt-5 space-y-2 border-t border-line/70 pt-4">
              {links.map((link, index) => (
                <li key={`${link.label}-${index}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between gap-3 text-sm text-text-hi"
                  >
                    <span className="truncate">{link.label}</span>
                    <ArrowUpRight className="size-3.5 shrink-0 text-text-lo transition-colors group-hover:text-ice" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {profile?.backstory ? (
        <details className="group panel-quiet overflow-hidden lg:col-span-12">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 sm:p-7">
            <ProfileSectionHeading kicker="The story" title="The longer arc" />
            <span className="text-xs text-ice group-open:hidden">Read the full story</span>
            <span className="hidden text-xs text-text-lo group-open:inline">Close</span>
          </summary>
          <div className="border-t border-line/70 px-6 pb-7 pt-5 sm:px-7">
            <p className="max-w-5xl whitespace-pre-wrap text-sm leading-7 text-text-hi/90">
              {profile.backstory}
            </p>
          </div>
        </details>
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
