"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useSceneMutations } from "@/hooks/use-scenes";
import { isSceneSlugAvailable } from "@/lib/api/scenes";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import type { SceneJoinPolicy, SceneKind, SceneVisibility } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS: { value: SceneKind; label: string }[] = [
  { value: "other", label: "Scene" },
  { value: "label", label: "Label" },
  { value: "school", label: "School" },
  { value: "crew", label: "Crew" },
  { value: "collective", label: "Collective" },
  { value: "genre", label: "Genre" },
  { value: "local", label: "Local" },
];

const DOORS: { value: SceneJoinPolicy; label: string; hint: string }[] = [
  { value: "open", label: "Open", hint: "Anyone can join" },
  { value: "request", label: "Ask to join", hint: "You approve each person" },
  { value: "invite", label: "Invite only", hint: "You add people yourself" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

export default function NewScenePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeArtist } = useActiveArtist();
  const { profile, isLoading: profileLoading } = useArtistProfile(
    activeArtist?.id ?? null
  );
  const onNetwork =
    profile?.visibility === "members" || profile?.visibility === "public";
  const { create } = useSceneMutations();

  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [kind, setKind] = React.useState<SceneKind>("other");
  const [tagline, setTagline] = React.useState("");
  const [about, setAbout] = React.useState("");
  const [joinPolicy, setJoinPolicy] = React.useState<SceneJoinPolicy>("request");
  const [visibility, setVisibility] = React.useState<SceneVisibility>("members");
  const [slugStatus, setSlugStatus] = React.useState<"idle" | "checking" | "free" | "taken">(
    "idle"
  );

  React.useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  React.useEffect(() => {
    const shape = /^[a-z0-9-]{3,40}$/;
    if (!shape.test(slug)) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const t = setTimeout(() => {
      isSceneSlugAvailable(slug)
        .then((free) => setSlugStatus(free ? "free" : "taken"))
        .catch(() => setSlugStatus("idle"));
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  const canSubmit =
    !!profile?.id &&
    name.trim().length >= 2 &&
    slugStatus === "free" &&
    !create.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.id || slugStatus !== "free") return;
    try {
      const scene = await create.mutateAsync({
        slug,
        name,
        kind,
        tagline,
        about,
        joinPolicy,
        visibility,
        ownerProfileId: profile.id,
      });
      toast(`${scene.name} is live.`, "ok");
      router.push(`/scenes/${scene.slug}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t create that scene.");
    }
  }

  if (!profileLoading && !onNetwork) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader title="Start a scene" />
        <EmptyShaderPanel
          title="Join the network first"
          copy="Starting a scene is a network act — publish your artist profile on Social or Artist, then come back here."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Start a scene"
        subtitle="A room for a label, a school, a crew, or a scene you're part of."
      />

      <form onSubmit={handleSubmit} className="panel space-y-5 p-5">
        <div>
          <label htmlFor="scene-name" className="label-mono">
            Name
          </label>
          <Input
            id="scene-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Midnight Collective"
            maxLength={60}
            className="mt-1.5"
            required
          />
        </div>

        <div>
          <label htmlFor="scene-slug" className="label-mono">
            Address
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-sm text-text-lo">tempo.app/scenes/</span>
            <div className="relative flex-1">
              <Input
                id="scene-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="midnight-collective"
                maxLength={40}
                required
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                {slugStatus === "checking" ? (
                  <Loader2 className="size-3.5 animate-spin text-text-lo" />
                ) : slugStatus === "free" ? (
                  <Check className="size-3.5 text-ok" />
                ) : slugStatus === "taken" ? (
                  <X className="size-3.5 text-warn" />
                ) : null}
              </span>
            </div>
          </div>
          {slugStatus === "taken" ? (
            <p className="mt-1 text-xs text-warn">That address is taken.</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="scene-kind" className="label-mono">
            Kind
          </label>
          <select
            id="scene-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as SceneKind)}
            className="mt-1.5 h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="scene-tagline" className="label-mono">
            Tagline
          </label>
          <Input
            id="scene-tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One line about what this scene is"
            maxLength={140}
            className="mt-1.5"
          />
        </div>

        <div>
          <label htmlFor="scene-about" className="label-mono">
            About
          </label>
          <Textarea
            id="scene-about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="What's this scene for, and who's it for?"
            maxLength={8000}
            className="mt-1.5"
            rows={4}
          />
        </div>

        <div>
          <p className="label-mono mb-2">The door</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {DOORS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setJoinPolicy(d.value)}
                className={cn(
                  "well rounded-input px-3 py-2.5 text-left transition-colors",
                  joinPolicy === d.value && "border-ice/40 bg-ice/10"
                )}
              >
                <p className="text-sm font-medium text-text-hi">{d.label}</p>
                <p className="mt-0.5 text-xs text-text-lo">{d.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="scene-visibility" className="label-mono">
            Who can find it
          </label>
          <select
            id="scene-visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as SceneVisibility)}
            className="mt-1.5 h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
          >
            <option value="members">Any TEMPO member can find it</option>
            <option value="unlisted">Only members can see it</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => router.push("/scenes")}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Create scene
          </Button>
        </div>
      </form>
    </div>
  );
}
