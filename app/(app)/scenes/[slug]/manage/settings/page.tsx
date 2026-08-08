"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { useScene, useSceneMutations } from "@/hooks/use-scenes";
import { SignedImage } from "@/components/ui/signed-image";
import { ArtistMark } from "@/components/artists/artist-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ARTIST_PALETTES } from "@/lib/artist-theme";
import type { SceneJoinPolicy, SceneVisibility } from "@/lib/types";
import { cn, errorMessage } from "@/lib/utils";

const DOORS: { value: SceneJoinPolicy; label: string; hint: string }[] = [
  { value: "open", label: "Open", hint: "Anyone can join" },
  { value: "request", label: "Ask to join", hint: "You approve each person" },
  { value: "invite", label: "Invite only", hint: "You add people yourself" },
];

export default function SceneSettingsPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { data: scene } = useScene(params.slug);
  const { update, archive, uploadBanner, uploadEmblem } = useSceneMutations();

  const [name, setName] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [about, setAbout] = React.useState("");
  const [joinPolicy, setJoinPolicy] = React.useState<SceneJoinPolicy>("request");
  const [visibility, setVisibility] = React.useState<SceneVisibility>("members");
  const [paletteId, setPaletteId] = React.useState<string>("spectra");
  const [confirmArchive, setConfirmArchive] = React.useState(false);

  const bannerInputRef = React.useRef<HTMLInputElement>(null);
  const emblemInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!scene) return;
    setName(scene.name);
    setTagline(scene.tagline ?? "");
    setAbout(scene.about ?? "");
    setJoinPolicy(scene.join_policy);
    setVisibility(scene.visibility);
    setPaletteId(scene.palette_id);
  }, [scene]);

  if (!scene) return null;

  if (scene.my_role !== "owner") {
    return <p className="text-sm text-text-lo">Only the owner can edit scene settings.</p>;
  }

  const dirty =
    name.trim() !== scene.name ||
    tagline !== (scene.tagline ?? "") ||
    about !== (scene.about ?? "") ||
    joinPolicy !== scene.join_policy ||
    visibility !== scene.visibility ||
    paletteId !== scene.palette_id;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!scene || name.trim().length < 2) return;
    try {
      await update.mutateAsync({
        scene,
        input: {
          name,
          tagline: tagline || null,
          about: about || null,
          joinPolicy,
          visibility,
          paletteId: paletteId as typeof scene.palette_id,
          iceColor: null,
          amberColor: null,
        },
      });
      toast("Settings saved.", "ok");
    } catch (err) {
      toast(errorMessage(err, "Couldn't save those changes."));
    }
  }

  async function handleBannerPick(file: File | undefined) {
    if (!file || !scene) return;
    try {
      await uploadBanner.mutateAsync({ scene, file });
      toast("Banner updated.", "ok");
    } catch (err) {
      toast(errorMessage(err, "Couldn't upload that banner."));
    }
  }

  async function handleEmblemPick(file: File | undefined) {
    if (!file || !scene) return;
    try {
      await uploadEmblem.mutateAsync({ scene, file });
      toast("Emblem updated.", "ok");
    } catch (err) {
      toast(errorMessage(err, "Couldn't upload that emblem."));
    }
  }

  async function handleArchive() {
    if (!scene) return;
    try {
      await archive.mutateAsync({ sceneId: scene.id });
      toast(`${scene.name} has been deleted.`, "ok");
      router.push("/scenes");
    } catch (err) {
      toast(errorMessage(err, "Couldn't delete that scene."));
    }
  }

  return (
    <div className="space-y-5">
      <div className="panel space-y-4 p-5">
        <p className="label-mono">Banner &amp; emblem</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative h-20 w-36 overflow-hidden rounded-input border border-line bg-bg-2">
            {scene.banner_url ? (
              <SignedImage path={scene.banner_url} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-[11px] text-text-lo">
                No banner
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ArtistMark
              emblemUrl={scene.emblem_url}
              paletteId={scene.palette_id}
              iceColor={scene.ice_color}
              amberColor={scene.amber_color}
              name={scene.name}
              size={48}
              className="size-12"
            />
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={uploadBanner.isPending}
                onClick={() => bannerInputRef.current?.click()}
              >
                {uploadBanner.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                Change banner
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={uploadEmblem.isPending}
                onClick={() => emblemInputRef.current?.click()}
              >
                {uploadEmblem.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                Change emblem
              </Button>
            </div>
          </div>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void handleBannerPick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={emblemInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void handleEmblemPick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <form onSubmit={handleSave} className="panel space-y-5 p-5">
        <div>
          <label htmlFor="settings-name" className="label-mono">
            Name
          </label>
          <Input
            id="settings-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="mt-1.5"
            required
          />
        </div>

        <div>
          <label htmlFor="settings-tagline" className="label-mono">
            Tagline
          </label>
          <Input
            id="settings-tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={140}
            className="mt-1.5"
          />
        </div>

        <div>
          <label htmlFor="settings-about" className="label-mono">
            About
          </label>
          <Textarea
            id="settings-about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
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
                aria-pressed={joinPolicy === d.value}
                className={cn(
                  "rounded-input border px-3 py-2.5 text-left transition-colors",
                  joinPolicy === d.value
                    ? "border-ice bg-ice/10"
                    : "border-line bg-bg-2 hover:border-ice/40"
                )}
              >
                <p
                  className={cn(
                    "text-sm font-medium",
                    joinPolicy === d.value ? "text-ice" : "text-text-hi"
                  )}
                >
                  {d.label}
                </p>
                <p className="mt-0.5 text-xs text-text-lo">{d.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="settings-visibility" className="label-mono">
            Who can find it
          </label>
          <select
            id="settings-visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as SceneVisibility)}
            className="mt-1.5 h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
          >
            <option value="members">Any TEMPO member can find it</option>
            <option value="unlisted">Only members can see it</option>
          </select>
        </div>

        <div>
          <p className="label-mono mb-2">Color</p>
          <div className="flex flex-wrap gap-2">
            {ARTIST_PALETTES.map((palette) => (
              <button
                key={palette.id}
                type="button"
                title={palette.label}
                aria-label={palette.label}
                aria-pressed={paletteId === palette.id}
                onClick={() => setPaletteId(palette.id)}
                className={cn(
                  "size-6 rounded-full border transition-colors",
                  paletteId === palette.id
                    ? "border-text-hi/70"
                    : "border-line hover:border-text-lo"
                )}
                style={{
                  background: `linear-gradient(135deg, ${palette.ice} 0%, #ffffff 50%, ${palette.amber} 100%)`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={!dirty || update.isPending}>
            {update.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </form>

      <div className="panel space-y-3 border-warn/30 p-5">
        <p className="label-mono text-warn">Danger zone</p>
        <p className="text-sm text-text-lo">
          Deleting {scene.name} removes it from search and browse for everyone. Its{" "}
          {scene.member_count} {scene.member_count === 1 ? "member" : "members"} and{" "}
          {scene.post_count} {scene.post_count === 1 ? "post" : "posts"} are kept, not erased —
          this can be reversed by contacting support.
        </p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setConfirmArchive(true)}
        >
          Delete scene
        </Button>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Delete ${scene.name}?`}
        description={`This removes ${scene.name} from search and browse for everyone. Its ${scene.member_count} ${scene.member_count === 1 ? "member" : "members"} and ${scene.post_count} ${scene.post_count === 1 ? "post" : "posts"} are kept, not erased.`}
        confirmLabel="Delete scene"
        typedValue={scene.name}
        busy={archive.isPending}
        onConfirm={handleArchive}
      />
    </div>
  );
}
