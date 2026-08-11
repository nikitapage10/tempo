"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  Eye,
  Globe,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { FlareLine } from "@/components/flare-line";
import { LfWindow } from "@/components/lf-windows";
import { SignedImage } from "@/components/ui/signed-image";
import { ArtistBanner } from "@/components/artists/artist-banner";
import { ArtistProfileImage } from "@/components/artists/artist-mark";
import { CityInput } from "@/components/artists/city-input";
import { ArtistProfileStoryView } from "@/components/artist/profile-story";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useProfileReleasedTracks } from "@/hooks/use-profile-released-tracks";
import { checkHandleAvailable } from "@/lib/api/artist-profile";
import type {
  ArtistProfileUpdate,
  ProfileDmPolicy,
  ProfileLink,
  ProfileSoundMarker,
  ProfileStorySection,
  ProfileVisibility,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const DM_OPTIONS: { value: ProfileDmPolicy; label: string }[] = [
  { value: "anyone", label: "Anyone" },
  { value: "connections", label: "People I follow back" },
  { value: "nobody", label: "Nobody" },
];

function isSafeWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type Draft = {
  handle: string;
  tagline: string;
  bio: string;
  story_sections: ProfileStorySection[];
  location: string;
  pronouns: string;
  genres: string[];
  roles: string[];
  links: ProfileLink[];
  sound_markers: ProfileSoundMarker[];
  current_focus_title: string;
  current_focus_body: string;
  accepts_dms: ProfileDmPolicy;
};

/**
 * The public-facing artist profile — bio, backstory, branding, links.
 * Catalog numbers live at /stats; this page is identity, not analytics.
 */
export default function ArtistProfilePage() {
  const { activeArtist, isLoading: artistLoading } = useActiveArtist();
  const { profile, isLoading, save, publish, unpublish } = useArtistProfile(
    activeArtist?.id ?? null
  );
  const { tracks: releasedTracks } = useProfileReleasedTracks(
    activeArtist?.id ?? null
  );
  const { toast } = useToast();

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft | null>(null);

  function startEditing() {
    setDraft({
      handle: profile?.handle ?? "",
      tagline: profile?.tagline ?? "",
      bio: profile?.bio ?? "",
      story_sections:
        profile?.story_sections?.length
          ? profile.story_sections
          : profile?.backstory
            ? [{ title: "The longer arc", body: profile.backstory }]
            : [],
      location: profile?.location ?? "",
      pronouns: profile?.pronouns ?? "",
      genres: profile?.genres ?? [],
      roles: profile?.roles ?? [],
      links: profile?.links ?? [],
      sound_markers: profile?.sound_markers ?? [],
      current_focus_title: profile?.current_focus_title ?? "",
      current_focus_body: profile?.current_focus_body ?? "",
      accepts_dms: profile?.accepts_dms ?? "connections",
    });
    setEditing(true);
  }

  async function handleSave() {
    if (!draft || !activeArtist) return;
    const handle = draft.handle.trim().toLowerCase();
    if (handle && !/^[a-z0-9_.]{3,30}$/.test(handle)) {
      toast("Handles are 3–30 characters: lowercase letters, numbers, _ or .");
      return;
    }
    if (handle && handle !== (profile?.handle ?? "")) {
      const available = await checkHandleAvailable(handle, activeArtist.id);
      if (!available) {
        toast(`@${handle} is already taken.`);
        return;
      }
    }
    const externalUrls = draft.links.map((link) => link.url).filter((url) => url.trim());
    if (externalUrls.some((url) => !isSafeWebUrl(url))) {
      toast("Links must begin with http:// or https://.");
      return;
    }
    const patch: ArtistProfileUpdate = {
      handle: handle || null,
      tagline: draft.tagline.trim() || null,
      bio: draft.bio.trim() || null,
      backstory: null,
      story_sections: draft.story_sections
        .map((section) => ({
          title: section.title.trim(),
          body: section.body.trim(),
        }))
        .filter((section) => section.title || section.body),
      location: draft.location.trim() || null,
      pronouns: draft.pronouns.trim() || null,
      genres: draft.genres,
      roles: draft.roles,
      links: draft.links.filter((l) => l.label.trim() && l.url.trim()),
      sound_markers: draft.sound_markers.filter((marker) => marker.label.trim()),
      current_focus_title: draft.current_focus_title.trim() || null,
      current_focus_body: draft.current_focus_body.trim() || null,
      accepts_dms: draft.accepts_dms,
    };
    try {
      await save.mutateAsync({ patch, displayName: activeArtist.name });
      setEditing(false);
      setDraft(null);
      toast("Profile saved.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t save your profile.");
    }
  }

  async function handleVisibilityChange(visibility: ProfileVisibility) {
    if (!profile && visibility !== "private") {
      toast("Shape and save the profile before joining the network.");
      startEditing();
      return;
    }
    if (visibility === "public" && !profile?.handle) {
      toast("Add a handle before making the profile public.");
      startEditing();
      return;
    }
    try {
      if (visibility === "private") {
        await unpublish.mutateAsync();
        toast("You’re off the network — profile is private.", "ok");
      } else {
        await publish.mutateAsync(visibility);
        toast(
          visibility === "public"
            ? "You’re on the network with a public link."
            : "You’re on the network — visible to TEMPO members.",
          "ok"
        );
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t change visibility.");
    }
  }

  const loading = artistLoading || isLoading;
  const busy = save.isPending || publish.isPending || unpublish.isPending;

  return (
    <div className="space-y-5">
      <LfWindow className="glass relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="scrim-reveal absolute inset-0" aria-hidden />
          {activeArtist ? (
            <ArtistBanner artist={activeArtist} fadeRight className="absolute inset-0" />
          ) : null}
        </div>

        {activeArtist?.emblem_url ? (
          <ArtistProfileImage
            emblemUrl={activeArtist.emblem_url}
            paletteId={activeArtist.palette_id}
            iceColor={activeArtist.ice_color}
            amberColor={activeArtist.amber_color}
            name={activeArtist.name}
            className="absolute inset-y-0 left-[13%] z-[1] hidden w-[23%] sm:flex"
          />
        ) : null}

        <div className="relative z-[2] flex flex-col gap-5 px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="label-mono mb-1.5">Artist profile</p>
              <h1 className="min-w-0 font-display text-3xl font-medium tracking-[0.025em] text-text-hi sm:text-[40px] sm:leading-[1.05]">
                {loading ? "—" : (activeArtist?.name ?? "No artist")}
              </h1>
              {profile?.handle ? (
                <p className="mt-1 text-sm text-text-lo">@{profile.handle}</p>
              ) : null}
              {profile?.tagline && !editing ? (
                <p className="mt-1.5 max-w-lg text-sm text-text-lo">{profile.tagline}</p>
              ) : null}
            </div>

            {!editing ? (
              <div className="flex flex-wrap justify-end gap-2">
                <label className="sr-only" htmlFor="profile-visibility">
                  Profile visibility
                </label>
                <div className="relative">
                  {profile?.visibility === "public" ? (
                    <Globe className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ice" />
                  ) : profile?.visibility === "members" ? (
                    <Users className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ice" />
                  ) : (
                    <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />
                  )}
                  <select
                    id="profile-visibility"
                    value={profile?.visibility ?? "private"}
                    onChange={(event) =>
                      void handleVisibilityChange(event.target.value as ProfileVisibility)
                    }
                    disabled={busy}
                    className="h-9 appearance-none rounded-chip border border-line bg-bg-0/70 py-1 pl-8 pr-7 text-xs text-text-hi backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-50"
                  >
                    <option value="private">Private</option>
                    <option value="members">TEMPO members</option>
                    <option value="public">Public</option>
                  </select>
                </div>
                {profile?.handle ? (
                  <Button asChild type="button" size="sm" variant="secondary">
                    <Link
                      href={profile.visibility === "public" ? `/p/${profile.handle}` : `/artist/${profile.handle}`}
                      target="_blank"
                    >
                      <Eye className="size-3.5" />
                      Preview
                    </Link>
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="secondary" onClick={startEditing}>
                  <Pencil className="size-3.5" />
                  Edit profile
                </Button>
              </div>
            ) : null}
          </div>

          <FlareLine className="max-w-[420px] opacity-60" />
        </div>

        {activeArtist?.logo_url ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] flex w-[min(46%,22rem)] items-end justify-end p-2 sm:p-3">
            <SignedImage
              path={activeArtist.logo_url}
              alt={activeArtist.name}
              className="h-auto max-h-[min(66%,9rem)] w-auto max-w-full object-contain sm:max-h-[11rem]"
            />
          </div>
        ) : null}
      </LfWindow>

      {editing && draft ? (
        <ProfileEditor
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          onCancel={() => {
            setEditing(false);
            setDraft(null);
          }}
          onSave={handleSave}
        />
      ) : (
        <ArtistProfileStoryView
          profile={profile}
          releasedTracks={releasedTracks}
          emptyAction={
            <Button type="button" size="sm" variant="secondary" onClick={startEditing} className="mt-1 w-fit">
              <Pencil className="size-3.5" />
              Shape the profile
            </Button>
          }
        />
      )}

      <div className="panel-quiet flex items-center gap-3 p-4">
        <BarChart3 className="size-4 shrink-0 text-text-lo" strokeWidth={1.75} />
        <p className="text-sm text-text-lo">
          Looking for track counts, bounce history, and your sound? That&rsquo;s
          now on the{" "}
          <Link href="/stats" className="text-ice hover:underline">
            Stats
          </Link>{" "}
          page.
        </p>
      </div>
    </div>
  );
}

function ProfileEditor({
  draft,
  setDraft,
  busy,
  onCancel,
  onSave,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [genreInput, setGenreInput] = React.useState("");
  const [roleInput, setRoleInput] = React.useState("");

  function patch(next: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...next } : d));
  }

  function addTag(kind: "genres" | "roles", value: string) {
    const v = value.trim();
    if (!v) return;
    const list = draft[kind];
    if (list.length >= 8 || list.includes(v)) return;
    patch({ [kind]: [...list, v] } as Partial<Draft>);
  }

  function removeTag(kind: "genres" | "roles", value: string) {
    patch({ [kind]: draft[kind].filter((v) => v !== value) } as Partial<Draft>);
  }

  function addLink() {
    if (draft.links.length >= 12) return;
    patch({ links: [...draft.links, { label: "", url: "" }] });
  }

  function updateLink(i: number, next: Partial<ProfileLink>) {
    patch({
      links: draft.links.map((l, idx) => (idx === i ? { ...l, ...next } : l)),
    });
  }

  function removeLink(i: number) {
    patch({ links: draft.links.filter((_, idx) => idx !== i) });
  }

  function addSoundMarker() {
    if (draft.sound_markers.length >= 5) return;
    patch({
      sound_markers: [...draft.sound_markers, { label: "", description: "" }],
    });
  }

  function updateSoundMarker(i: number, next: Partial<ProfileSoundMarker>) {
    patch({
      sound_markers: draft.sound_markers.map((marker, index) =>
        index === i ? { ...marker, ...next } : marker
      ),
    });
  }

  function removeSoundMarker(i: number) {
    patch({ sound_markers: draft.sound_markers.filter((_, index) => index !== i) });
  }

  function addStorySection() {
    if (draft.story_sections.length >= 8) return;
    patch({ story_sections: [...draft.story_sections, { title: "", body: "" }] });
  }

  function updateStorySection(i: number, next: Partial<ProfileStorySection>) {
    patch({
      story_sections: draft.story_sections.map((section, index) =>
        index === i ? { ...section, ...next } : section
      ),
    });
  }

  function removeStorySection(i: number) {
    patch({ story_sections: draft.story_sections.filter((_, index) => index !== i) });
  }

  function moveStorySection(i: number, offset: -1 | 1) {
    const destination = i + offset;
    if (destination < 0 || destination >= draft.story_sections.length) return;
    const sections = [...draft.story_sections];
    [sections[i], sections[destination]] = [sections[destination], sections[i]];
    patch({ story_sections: sections });
  }

  return (
    <div className="panel flex flex-col gap-6 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Handle" hint="Lowercase, 3–30 chars — letters, numbers, _ or .">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-text-lo">@</span>
            <Input
              value={draft.handle}
              onChange={(e) => patch({ handle: e.target.value.toLowerCase() })}
              placeholder="nikitapage"
              maxLength={30}
            />
          </div>
        </Field>
        <Field label="Tagline" hint="One line, up to 140 characters.">
          <Input
            value={draft.tagline}
            onChange={(e) => patch({ tagline: e.target.value })}
            placeholder="Producer & songwriter"
            maxLength={140}
          />
        </Field>
        <Field label="Location">
          <CityInput
            value={draft.location}
            onChange={(v) => patch({ location: v })}
            placeholder="Los Angeles, CA"
          />
        </Field>
        <Field label="Pronouns">
          <Input
            value={draft.pronouns}
            onChange={(e) => patch({ pronouns: e.target.value })}
            placeholder="they/them"
          />
        </Field>
      </div>

      <Field label="About" hint="A concise introduction, up to 2,000 characters.">
        <Textarea
          value={draft.bio}
          onChange={(e) => patch({ bio: e.target.value })}
          maxLength={2000}
          rows={3}
          placeholder="A short introduction people see first."
        />
      </Field>

      <Field
        label="Right now"
        hint="A living snapshot of the part of the work carrying the most energy."
      >
        <div className="grid gap-2">
          <Input
            value={draft.current_focus_title}
            onChange={(e) => patch({ current_focus_title: e.target.value })}
            maxLength={120}
            placeholder="What is taking shape?"
          />
          <Textarea
            value={draft.current_focus_body}
            onChange={(e) => patch({ current_focus_body: e.target.value })}
            maxLength={1000}
            rows={3}
            placeholder="A release, a new direction, a live idea, or the question you are following now."
          />
        </div>
      </Field>

      <Field label="The sound" hint="Up to 5 qualities people can hear or feel in the work.">
        <div className="space-y-2">
          {draft.sound_markers.map((marker, i) => (
            <div key={i} className="well grid gap-2 rounded-input p-3 sm:grid-cols-[11rem_1fr_auto]">
              <Input
                value={marker.label}
                onChange={(e) => updateSoundMarker(i, { label: e.target.value })}
                placeholder="Cinematic tension"
                maxLength={60}
              />
              <Input
                value={marker.description}
                onChange={(e) => updateSoundMarker(i, { description: e.target.value })}
                placeholder="How it shows up in the work"
                maxLength={300}
              />
              <button
                type="button"
                onClick={() => removeSoundMarker(i)}
                className="self-center rounded-input p-2 text-text-lo transition-colors hover:text-warn"
                aria-label="Remove sound marker"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {draft.sound_markers.length < 5 ? (
            <button
              type="button"
              onClick={addSoundMarker}
              className="flex items-center gap-1 rounded-chip border border-dashed border-line px-2.5 py-1 text-xs text-ice transition-colors hover:border-ice/50 hover:bg-ice/10"
            >
              <Plus className="size-3" /> Add a marker
            </button>
          ) : null}
        </div>
      </Field>

      <Field label="The story" hint="Build the longer arc in sections. Add, remove, and reorder up to 8.">
        <div className="space-y-2">
          {draft.story_sections.map((section, i) => (
            <div key={i} className="well grid gap-2 rounded-input p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={section.title}
                  onChange={(e) => updateStorySection(i, { title: e.target.value })}
                  maxLength={120}
                  placeholder="Chapter title"
                  aria-label={`Story section ${i + 1} title`}
                  className="flex-1 font-display"
                />
                <button
                  type="button"
                  onClick={() => moveStorySection(i, -1)}
                  disabled={i === 0}
                  className="rounded-input p-2 text-text-lo transition-colors hover:text-text-hi disabled:opacity-30"
                  aria-label="Move story section up"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveStorySection(i, 1)}
                  disabled={i === draft.story_sections.length - 1}
                  className="rounded-input p-2 text-text-lo transition-colors hover:text-text-hi disabled:opacity-30"
                  aria-label="Move story section down"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeStorySection(i)}
                  className="rounded-input p-2 text-text-lo transition-colors hover:text-warn"
                  aria-label="Remove story section"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <Textarea
                value={section.body}
                onChange={(e) => updateStorySection(i, { body: e.target.value })}
                maxLength={2000}
                rows={4}
                placeholder="Write this part of the story in your own words."
                aria-label={`Story section ${i + 1} body`}
              />
            </div>
          ))}
          {draft.story_sections.length < 8 ? (
            <button
              type="button"
              onClick={addStorySection}
              className="flex items-center gap-1 rounded-chip border border-dashed border-line px-2.5 py-1 text-xs text-ice transition-colors hover:border-ice/50 hover:bg-ice/10"
            >
              <Plus className="size-3" /> Add a story section
            </button>
          ) : null}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Genres" hint="Up to 8.">
          <TagInput
            value={genreInput}
            onChange={setGenreInput}
            onAdd={() => {
              addTag("genres", genreInput);
              setGenreInput("");
            }}
            placeholder="Add a genre"
          />
          <TagList items={draft.genres} onRemove={(v) => removeTag("genres", v)} />
        </Field>
        <Field label="Roles" hint="Up to 8.">
          <TagInput
            value={roleInput}
            onChange={setRoleInput}
            onAdd={() => {
              addTag("roles", roleInput);
              setRoleInput("");
            }}
            placeholder="Add a role"
          />
          <TagList
            items={draft.roles}
            tone="ice"
            onRemove={(v) => removeTag("roles", v)}
          />
        </Field>
      </div>

      <Field label="Links" hint="Up to 12 — Spotify, socials, your site.">
        <div className="space-y-2">
          {draft.links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={link.label}
                onChange={(e) => updateLink(i, { label: e.target.value })}
                placeholder="Label"
                className="w-32 shrink-0"
                maxLength={40}
              />
              <Input
                value={link.url}
                onChange={(e) => updateLink(i, { url: e.target.value })}
                placeholder="https://…"
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeLink(i)}
                className="shrink-0 rounded-input p-1.5 text-text-lo transition-colors duration-hover hover:text-warn"
                aria-label="Remove link"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {draft.links.length < 12 ? (
            <button
              type="button"
              onClick={addLink}
              className="flex items-center gap-1 rounded-chip border border-dashed border-line px-2.5 py-1 text-xs text-ice transition-colors duration-hover hover:border-ice/50 hover:bg-ice/10"
            >
              <Plus className="size-3" />
              Add link
            </button>
          ) : null}
        </div>
      </Field>

      <Field label="Who can message you">
        <select
          value={draft.accepts_dms}
          onChange={(e) => patch({ accepts_dms: e.target.value as ProfileDmPolicy })}
          className="h-9 w-full max-w-xs rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice sm:w-auto"
        >
          {DM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          <X className="size-3.5" />
          Cancel
        </Button>
        <Button type="button" onClick={onSave} disabled={busy}>
          <Check className="size-3.5" />
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="label-mono mb-1.5">{label}</p>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-text-lo">{hint}</p> : null}
    </div>
  );
}

function TagInput({
  value,
  onChange,
  onAdd,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd();
          }
        }}
        placeholder={placeholder}
        maxLength={40}
      />
      <Button type="button" size="sm" variant="secondary" onClick={onAdd}>
        Add
      </Button>
    </div>
  );
}

function TagList({
  items,
  onRemove,
  tone = "default",
}: {
  items: string[];
  onRemove: (v: string) => void;
  tone?: "default" | "ice";
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "flex items-center gap-1 rounded-chip border px-2.5 py-1 text-xs",
            tone === "ice"
              ? "border-ice/30 bg-ice/10 text-ice"
              : "border-line text-text-lo"
          )}
        >
          {item}
          <button
            type="button"
            onClick={() => onRemove(item)}
            aria-label={`Remove ${item}`}
            className="opacity-70 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
