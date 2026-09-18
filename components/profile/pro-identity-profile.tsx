"use client";

import * as React from "react";
import { Check, Eye, Globe, Lock, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useActiveArtist } from "@/components/active-artist-provider";
import {
  ArtistProfileStoryView,
  type ArtistProfileStory,
} from "@/components/artist/profile-story";
import { CityInput } from "@/components/artists/city-input";
import { JoinNetworkDialog } from "@/components/social/join-network-dialog";
import { HandleField, type HandleState } from "@/components/social/handle-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { checkHandleAvailable } from "@/lib/api/artist-profile";
import { fetchMemberPassage } from "@/lib/api/member-passage";
import {
  applyPassageToProfile,
  needsPassageProfileRepair,
  passageProfilePatch,
} from "@/lib/passage/profile-mapping";
import { normalizeHandle, validateHandle } from "@/lib/social/handle";
import type {
  ArtistProfileUpdate,
  ProfileDmPolicy,
  ProfileLink,
  ProfileStorySection,
  ProfileVisibility,
} from "@/lib/types";

type Draft = {
  handle: string;
  tagline: string;
  bio: string;
  location: string;
  pronouns: string;
  roles: string[];
  links: ProfileLink[];
  current_focus_title: string;
  current_focus_body: string;
  story_sections: ProfileStorySection[];
  accepts_dms: ProfileDmPolicy;
};

const DM_OPTIONS: { value: ProfileDmPolicy; label: string }[] = [
  { value: "anyone", label: "Anyone" },
  { value: "connections", label: "People I follow back" },
  { value: "nobody", label: "Nobody" },
];

function safeWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function ProIdentityProfile() {
  const queryClient = useQueryClient();
  const { activeArtist } = useActiveArtist();
  const { mode } = useWorkspaceMode();
  const { profile, isLoading, save, publish, unpublish } = useArtistProfile(
    activeArtist?.id ?? null
  );
  const passage = useQuery({
    queryKey: ["member-passage", "profile"],
    queryFn: fetchMemberPassage,
    staleTime: 60_000,
  });
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [joinOpen, setJoinOpen] = React.useState(false);
  const [joinVisibility, setJoinVisibility] = React.useState<"members" | "public">("members");
  const passageRepairRef = React.useRef<string | null>(null);
  const passageNeedsRepair = Boolean(
    passage.data && needsPassageProfileRepair(profile, passage.data)
  );

  const passagePatch = React.useMemo(
    () =>
      passage.data && passageNeedsRepair
        ? passageProfilePatch(profile, passage.data)
        : {},
    [passage.data, passageNeedsRepair, profile]
  );
  const effectiveTagline =
    profile?.tagline ||
    (typeof passagePatch.tagline === "string" ? passagePatch.tagline : null);
  const storyProfile = React.useMemo<ArtistProfileStory | null>(() => {
    if (profile) return { ...profile, ...passagePatch };
    if (!passageNeedsRepair) return null;
    return {
      bio: passagePatch.bio ?? null,
      backstory: null,
      genres: [],
      roles: passagePatch.roles ?? [],
      links: [],
      story_sections: passagePatch.story_sections ?? [],
      sound_markers: [],
      current_focus_title: passagePatch.current_focus_title ?? null,
      current_focus_body: passagePatch.current_focus_body ?? null,
    };
  }, [passageNeedsRepair, passagePatch, profile]);

  /** Backfill completed Passage answers for Pros onboarded before this handoff existed. */
  React.useEffect(() => {
    const source = passage.data;
    if (
      mode !== "work" ||
      activeArtist?.workspace_kind !== "personal" ||
      isLoading ||
      passage.isLoading ||
      source?.status !== "complete" ||
      !passageNeedsRepair
    ) {
      return;
    }
    const repairKey = `${activeArtist.id}:${source.updatedAt ?? source.completedAt ?? "complete"}`;
    if (passageRepairRef.current === repairKey) return;
    passageRepairRef.current = repairKey;

    void applyPassageToProfile(
      activeArtist.id,
      source,
      source.displayName?.trim() || activeArtist.name
    )
      .then((next) => {
        if (next) {
          queryClient.setQueryData(["artist-profile", activeArtist.id], next);
        }
      })
      .catch(() => {
        passageRepairRef.current = null;
      });
  }, [
    activeArtist,
    isLoading,
    mode,
    passage.data,
    passage.isLoading,
    passageNeedsRepair,
    queryClient,
  ]);

  function startEditing() {
    const savedPassage = passage.data;
    const passageRoles = [
      ...(savedPassage?.roleTitles ?? []),
      ...(savedPassage?.roleTitleOther?.trim() ? [savedPassage.roleTitleOther.trim()] : []),
    ];
    setDraft({
      handle: profile?.handle ?? "",
      tagline: profile?.tagline ?? savedPassage?.interpretation?.headline ?? "",
      bio: profile?.bio ?? savedPassage?.interpretation?.intro ?? "",
      location: profile?.location ?? "",
      pronouns: profile?.pronouns ?? "",
      roles: profile?.roles?.length ? profile.roles : passageRoles,
      links: profile?.links ?? [],
      current_focus_title: profile?.current_focus_title ?? "",
      current_focus_body: profile?.current_focus_body ?? savedPassage?.functionText ?? "",
      story_sections: profile?.story_sections?.length
        ? profile.story_sections
        : (savedPassage?.interpretation?.storySections ?? []),
      accepts_dms: profile?.accepts_dms ?? "connections",
    });
    setEditing(true);
  }

  async function handleSave() {
    if (!draft || !activeArtist) return;
    const rawHandle = draft.handle.trim();
    let handle: string | null = null;
    if (rawHandle) {
      const checked = validateHandle(rawHandle);
      if (!checked.ok) {
        toast(checked.message);
        return;
      }
      handle = checked.handle;
      if (handle !== profile?.handle && !(await checkHandleAvailable(handle, activeArtist.id))) {
        toast(`@${handle} is already taken.`);
        return;
      }
    }
    const links = draft.links
      .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
      .filter((link) => link.label && link.url);
    if (links.some((link) => !safeWebUrl(link.url))) {
      toast("Links must begin with http:// or https://.");
      return;
    }
    const patch: ArtistProfileUpdate = {
      profile_kind: "pro",
      handle,
      tagline: draft.tagline.trim() || null,
      bio: draft.bio.trim() || null,
      location: draft.location.trim() || null,
      pronouns: draft.pronouns.trim() || null,
      roles: draft.roles.map((role) => role.trim()).filter(Boolean).slice(0, 8),
      links,
      current_focus_title: draft.current_focus_title.trim() || null,
      current_focus_body: draft.current_focus_body.trim() || null,
      story_sections: draft.story_sections
        .map((section) => ({ title: section.title.trim(), body: section.body.trim() }))
        .filter((section) => section.title || section.body),
      accepts_dms: draft.accepts_dms,
    };
    try {
      await save.mutateAsync({ patch, displayName: activeArtist.name });
      setEditing(false);
      setDraft(null);
      toast("Professional profile saved.", "ok");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t save your profile.");
    }
  }

  async function setVisibility(visibility: ProfileVisibility) {
    if (visibility !== "private" && !profile?.handle) {
      setJoinVisibility(visibility);
      setJoinOpen(true);
      return;
    }
    try {
      if (visibility === "private") await unpublish.mutateAsync();
      else await publish.mutateAsync(visibility);
      toast(visibility === "private" ? "Your profile is private." : "Profile visibility updated.", "ok");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn’t change visibility.");
    }
  }

  const busy = save.isPending || publish.isPending || unpublish.isPending;
  const hasProfileStory = Boolean(
    effectiveTagline || storyProfile?.bio || storyProfile?.roles.length ||
    storyProfile?.story_sections?.length || storyProfile?.current_focus_title ||
    storyProfile?.current_focus_body || storyProfile?.links.length
  );

  // /profile is also a safe account route for artist owners, but their
  // release identity belongs on /artist. Never let a manually typed URL turn
  // an artist profile into a Pro profile.
  if (mode !== "work") return null;

  return (
    <section className="space-y-4">
      <JoinNetworkDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        artistId={activeArtist?.id ?? null}
        artistName={activeArtist?.name}
        currentHandle={profile?.handle}
        visibility={joinVisibility}
        onJoined={() => toast("Your professional profile is now on the network.", "ok")}
      />

      <div data-tour="pro-identity" className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="label-mono text-ice">Professional identity</p>
          <h2 className="mt-2 font-display text-xl text-text-hi">
            {effectiveTagline || "Tell people what you do and how you got here"}
          </h2>
          <p className="mt-1 text-sm text-text-lo">
            {profile?.handle ? `@${profile.handle}` : "Claim a TEMPO handle so people can find and mention you."}
            {profile?.pronouns ? ` · ${profile.pronouns}` : ""}
            {profile?.location ? ` · ${profile.location}` : ""}
          </p>
        </div>
        {!editing ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <div className="relative">
              {profile?.visibility === "public" ? <Globe className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ice" /> : profile?.visibility === "members" ? <Users className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ice" /> : <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-lo" />}
              <select
                aria-label="Professional profile visibility"
                value={profile?.visibility ?? "private"}
                onChange={(event) => void setVisibility(event.target.value as ProfileVisibility)}
                disabled={busy || isLoading}
                className="h-9 appearance-none rounded-chip border border-line bg-bg-2 py-1 pl-8 pr-7 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <option value="private">Private</option>
                <option value="members">TEMPO members</option>
                <option value="public">Public</option>
              </select>
            </div>
            {profile?.handle ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={profile.visibility === "public" ? `/p/${profile.handle}` : `/artist/${profile.handle}`} target="_blank">
                  <Eye className="size-3.5" /> Preview
                </Link>
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={startEditing} disabled={isLoading}>
              <Pencil className="size-3.5" /> {hasProfileStory ? "Edit details" : "Build profile"}
            </Button>
          </div>
        ) : null}
      </div>

      {editing && draft ? (
        <ProProfileEditor
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          artistId={activeArtist?.id}
          currentHandle={profile?.handle}
          onSave={() => void handleSave()}
          onCancel={() => { setEditing(false); setDraft(null); }}
        />
      ) : (
        <ArtistProfileStoryView
          profile={storyProfile}
          variant="pro"
          emptyAction={<Button type="button" size="sm" variant="secondary" onClick={startEditing}><Pencil className="size-3.5" /> Build your profile</Button>}
        />
      )}
    </section>
  );
}

function ProProfileEditor({ draft, setDraft, busy, artistId, currentHandle, onSave, onCancel }: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
  busy: boolean;
  artistId?: string;
  currentHandle?: string | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [role, setRole] = React.useState("");
  const [handleState, setHandleState] = React.useState<HandleState>({ value: "", ready: false });
  const handleBlocksSave = Boolean(normalizeHandle(draft.handle)) && !handleState.ready;
  const patch = (next: Partial<Draft>) => setDraft((current) => current ? { ...current, ...next } : current);
  const addRole = () => {
    const value = role.trim();
    if (!value || draft.roles.includes(value) || draft.roles.length >= 8) return;
    patch({ roles: [...draft.roles, value] });
    setRole("");
  };
  const updateStory = (index: number, next: Partial<ProfileStorySection>) => patch({ story_sections: draft.story_sections.map((section, i) => i === index ? { ...section, ...next } : section) });
  const updateLink = (index: number, next: Partial<ProfileLink>) => patch({ links: draft.links.map((link, i) => i === index ? { ...link, ...next } : link) });

  return (
    <div className="panel space-y-6 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 sm:max-w-md">
          <HandleField
            id="pro-profile-handle"
            value={draft.handle}
            onChange={(next) => patch({ handle: next.toLowerCase() })}
            onStateChange={setHandleState}
            currentArtistId={artistId}
            currentHandle={currentHandle}
            disabled={busy}
          />
        </div>
        <Field label="Professional headline" hint="One clear line about what you do.">
          <Input value={draft.tagline} onChange={(event) => patch({ tagline: event.target.value })} placeholder="Artist manager · touring and long-term strategy" maxLength={140} />
        </Field>
        <Field label="Location"><CityInput value={draft.location} onChange={(location) => patch({ location })} placeholder="Nashville, TN" /></Field>
        <Field label="Pronouns"><Input value={draft.pronouns} onChange={(event) => patch({ pronouns: event.target.value })} placeholder="she/her" maxLength={40} /></Field>
      </div>

      <Field label="About" hint="Your professional introduction, up to 2,000 characters.">
        <Textarea value={draft.bio} onChange={(event) => patch({ bio: event.target.value })} rows={5} maxLength={2000} placeholder="What you do, who you support, and the perspective you bring." />
      </Field>

      <Field label="Roles" hint="The hats you actually wear—up to eight.">
        <div className="flex gap-2"><Input value={role} onChange={(event) => setRole(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addRole(); } }} placeholder="Manager, publicist, tour manager…" maxLength={40} /><Button type="button" size="sm" variant="secondary" onClick={addRole}>Add</Button></div>
        <div className="mt-2 flex flex-wrap gap-1.5">{draft.roles.map((item) => <span key={item} className="flex items-center gap-1 rounded-chip border border-ice/30 bg-ice/10 px-2.5 py-1 text-xs text-ice">{item}<button type="button" onClick={() => patch({ roles: draft.roles.filter((value) => value !== item) })} aria-label={`Remove ${item}`}><X className="size-3" /></button></span>)}</div>
      </Field>

      <Field label="Current focus" hint="The work carrying the most energy right now.">
        <div className="grid gap-2"><Input value={draft.current_focus_title} onChange={(event) => patch({ current_focus_title: event.target.value })} placeholder="Building the next campaign" maxLength={120} /><Textarea value={draft.current_focus_body} onChange={(event) => patch({ current_focus_body: event.target.value })} rows={3} maxLength={1000} placeholder="What you are moving forward, solving, or looking for." /></div>
      </Field>

      <Field label="Career story" hint="Add meaningful chapters, milestones, or changes in direction.">
        <div className="space-y-2">{draft.story_sections.map((section, index) => <div key={index} className="well space-y-2 rounded-input p-3"><div className="flex gap-2"><Input value={section.title} onChange={(event) => updateStory(index, { title: event.target.value })} placeholder="A chapter or milestone" maxLength={100} /><button type="button" onClick={() => patch({ story_sections: draft.story_sections.filter((_, i) => i !== index) })} aria-label="Remove career chapter" className="rounded-input p-2 text-text-lo hover:text-warn"><Trash2 className="size-3.5" /></button></div><Textarea value={section.body} onChange={(event) => updateStory(index, { body: event.target.value })} rows={4} maxLength={2000} placeholder="What happened, what changed, and what it taught you." /></div>)}</div>
        {draft.story_sections.length < 8 ? <button type="button" onClick={() => patch({ story_sections: [...draft.story_sections, { title: "", body: "" }] })} className="mt-2 flex items-center gap-1 rounded-chip border border-dashed border-line px-2.5 py-1 text-xs text-ice"><Plus className="size-3" /> Add career chapter</button> : null}
      </Field>

      <Field label="Links" hint="Your site, company, roster, socials, or professional work.">
        <div className="space-y-2">{draft.links.map((link, index) => <div key={index} className="flex gap-2"><Input value={link.label} onChange={(event) => updateLink(index, { label: event.target.value })} placeholder="Label" className="w-32" maxLength={40} /><Input value={link.url} onChange={(event) => updateLink(index, { url: event.target.value })} placeholder="https://…" /><button type="button" onClick={() => patch({ links: draft.links.filter((_, i) => i !== index) })} aria-label="Remove link" className="rounded-input p-2 text-text-lo hover:text-warn"><Trash2 className="size-3.5" /></button></div>)}</div>
        {draft.links.length < 12 ? <button type="button" onClick={() => patch({ links: [...draft.links, { label: "", url: "" }] })} className="mt-2 flex items-center gap-1 rounded-chip border border-dashed border-line px-2.5 py-1 text-xs text-ice"><Plus className="size-3" /> Add link</button> : null}
      </Field>

      <Field label="Who can message you"><select value={draft.accepts_dms} onChange={(event) => patch({ accepts_dms: event.target.value as ProfileDmPolicy })} className="h-9 rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi">{DM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>

      <div className="flex justify-end gap-2 border-t border-line pt-4"><Button type="button" variant="secondary" onClick={onCancel} disabled={busy}><X className="size-3.5" /> Cancel</Button><Button type="button" onClick={onSave} disabled={busy || handleBlocksSave}><Check className="size-3.5" /> {busy ? "Saving…" : "Save profile"}</Button></div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><p className="label-mono mb-1.5">{label}</p>{children}{hint ? <p className="mt-1 text-xs text-text-lo">{hint}</p> : null}</div>;
}
