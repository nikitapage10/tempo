"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft, ImagePlus, Loader2, X } from "lucide-react";
import {
  useActiveArtist,
  useArtistMutations,
} from "@/components/active-artist-provider";
import { ArtistBanner } from "@/components/artists/artist-banner";
import { ArtistMark } from "@/components/artists/artist-mark";
import { HexColorInput } from "@/components/artists/hex-color-input";
import { OriginScrim } from "@/components/origin/origin-copy-layer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SignedImage } from "@/components/ui/signed-image";
import { useToast } from "@/components/ui/toast";
import {
  ARTIST_PALETTES,
  BANNER_COLORS,
  hasCustomAccent,
  resolveArtistAccent,
} from "@/lib/artist-theme";
import type { Artist } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Optional look beat — palette, logo, profile image, banner — before the
 * frequencies / story. Continue and Skip both advance; Spectra defaults stand
 * in for anything left blank. Palette writes are optimistic so Origin chrome
 * fades into the chosen Cool/Warm immediately.
 *
 * Shared with PASSAGE (components/passage/passage-experience.tsx): a team
 * member customizes their own workspace with exactly the same controls, so
 * only the words around them are overridable.
 */
export function OriginLookStep({
  onBack,
  onFinish,
  busy,
  kicker = "Look / 03",
  heading = "Give the signal a look",
  blurb = "Colors, mark, and banner, all optional. You can change any of this later in Settings.",
}: {
  onBack: () => void;
  onFinish: () => void;
  busy: boolean;
  kicker?: string;
  heading?: string;
  blurb?: string;
}) {
  const { activeArtist } = useActiveArtist();
  const {
    updatePalette,
    setCustomAccent,
    uploadLogo,
    clearLogo,
    uploadEmblem,
    clearEmblem,
    uploadBanner,
    setBannerColor,
  } = useArtistMutations();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);

  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const emblemInputRef = React.useRef<HTMLInputElement>(null);
  const bannerInputRef = React.useRef<HTMLInputElement>(null);

  if (!activeArtist) {
    return (
      <OriginScrim
        tone="story"
        className="pointer-events-auto relative flex w-full max-w-2xl flex-col gap-4 overflow-hidden border-line bg-[linear-gradient(135deg,rgb(7_8_11/0.88),rgb(14_15_20/0.80))] p-7 shadow-[0_24px_80px_rgb(0_0_0/0.52)] backdrop-blur-2xl sm:px-9 sm:py-8"
      >
        <p className="text-sm text-text-lo">Loading artist…</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onFinish}
            disabled={busy}
            className="text-text-lo"
          >
            Skip for now
          </Button>
          <Button
            type="button"
            onClick={onFinish}
            disabled={busy}
            className="ml-auto rounded-full px-5"
          >
            Continue <ArrowRight className="size-4" />
          </Button>
        </div>
      </OriginScrim>
    );
  }

  const artist = activeArtist;
  const imageBusy =
    (uploadLogo.isPending && uploadLogo.variables?.artist.id === artist.id) ||
    (clearLogo.isPending && clearLogo.variables?.id === artist.id) ||
    (uploadEmblem.isPending && uploadEmblem.variables?.artist.id === artist.id) ||
    (clearEmblem.isPending && clearEmblem.variables?.id === artist.id) ||
    (uploadBanner.isPending && uploadBanner.variables?.artist.id === artist.id) ||
    (setBannerColor.isPending && setBannerColor.variables?.artist.id === artist.id);

  async function withImage(
    files: FileList | null,
    action: (file: File) => Promise<unknown>,
    okMessage: string
  ) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Pick an image file (png, jpg, webp).");
      return;
    }
    try {
      await action(file);
      toast(okMessage, "ok");
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn’t upload that image. Try a smaller file."
      );
    }
  }

  return (
    <OriginScrim
      tone="story"
      className="origin-look-step pointer-events-auto relative flex w-full max-w-2xl flex-col gap-6 overflow-hidden border-line bg-[linear-gradient(135deg,rgb(7_8_11/0.88),rgb(14_15_20/0.80))] p-0 shadow-[0_24px_80px_rgb(0_0_0/0.52)] backdrop-blur-2xl"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(to_bottom,transparent,var(--ice),var(--amber),transparent)] opacity-75"
      />
      <div className="relative flex max-h-[min(84vh,720px)] flex-col gap-5 overflow-y-auto px-7 py-8 sm:px-9">
        <button
          type="button"
          onClick={onBack}
          className="flex w-fit items-center gap-1 text-xs text-text-lo transition-colors hover:text-text-hi"
        >
          <ChevronLeft className="size-3.5" /> Back
        </button>

        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-[0.28em] text-text-lo/70">
            {kicker}
          </p>
          <h1 className="font-display text-3xl leading-tight text-text-hi sm:text-4xl">
            {heading}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-text-hi/75">
            {blurb}
          </p>
        </div>

        <LookPreview artist={artist} />

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-lo">
            Color scheme
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {ARTIST_PALETTES.map((palette) => {
              const selected =
                !hasCustomAccent(artist) && artist.palette_id === palette.id;
              return (
                <button
                  key={palette.id}
                  type="button"
                  title={palette.label}
                  aria-label={palette.label}
                  aria-pressed={selected}
                  onClick={() =>
                    updatePalette.mutate({ id: artist.id, paletteId: palette.id })
                  }
                  className={cn(
                    "size-6 rounded-full border transition-[border-color,box-shadow] duration-500",
                    selected
                      ? "border-text-hi/70 shadow-[0_0_0_1px_rgb(var(--ice-rgb)/0.35)]"
                      : "border-line hover:border-text-lo"
                  )}
                  style={{
                    background: `linear-gradient(135deg, ${palette.ice} 0%, #ffffff 50%, ${palette.amber} 100%)`,
                  }}
                />
              );
            })}
            <LookCustomAccentButton
              artist={artist}
              onCommit={(ice, amber) =>
                setCustomAccent.mutateAsync({ artist, ice, amber })
              }
              onError={setError}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <LookUploadRow
              label="Logo"
              hint="wide mark"
              inputRef={logoInputRef}
              busy={
                uploadLogo.isPending &&
                uploadLogo.variables?.artist.id === artist.id
              }
              clearing={
                clearLogo.isPending && clearLogo.variables?.id === artist.id
              }
              hasValue={!!artist.logo_url}
              disabled={imageBusy}
              onPick={() => logoInputRef.current?.click()}
              preview={
                artist.logo_url ? (
                  <div className="flex h-11 w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-input border border-line/60 bg-bg-0/35 px-1.5">
                    <SignedImage
                      path={artist.logo_url}
                      alt=""
                      className="max-h-8 max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-11 w-[4.5rem] shrink-0 items-center justify-center rounded-input border border-dashed border-line/50 bg-bg-0/20"
                    aria-hidden
                  >
                    <ImagePlus className="size-3.5 text-text-lo/50" />
                  </div>
                )
              }
              onFile={(files) =>
                void withImage(
                  files,
                  (file) => uploadLogo.mutateAsync({ artist, file }),
                  "Logo updated"
                )
              }
              onClear={() =>
                void (async () => {
                  try {
                    await clearLogo.mutateAsync(artist);
                    toast("Logo removed", "ok");
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Could not remove logo."
                    );
                  }
                })()
              }
            />
            <LookUploadRow
              label="Profile"
              hint="photo or emblem"
              inputRef={emblemInputRef}
              busy={
                uploadEmblem.isPending &&
                uploadEmblem.variables?.artist.id === artist.id
              }
              clearing={
                clearEmblem.isPending && clearEmblem.variables?.id === artist.id
              }
              hasValue={!!artist.emblem_url}
              disabled={imageBusy}
              onPick={() => emblemInputRef.current?.click()}
              preview={
                <ArtistMark
                  emblemUrl={artist.emblem_url}
                  paletteId={artist.palette_id}
                  iceColor={artist.ice_color}
                  amberColor={artist.amber_color}
                  name={artist.name}
                  size={44}
                  className="size-11 shrink-0 shadow-e1 ring-1 ring-line/70"
                />
              }
              onFile={(files) =>
                void withImage(
                  files,
                  (file) => uploadEmblem.mutateAsync({ artist, file }),
                  "Profile image updated"
                )
              }
              onClear={() =>
                void (async () => {
                  try {
                    await clearEmblem.mutateAsync(artist);
                    toast("Profile image removed", "ok");
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Could not remove profile image."
                    );
                  }
                })()
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-text-lo">
              Banner
            </span>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void withImage(
                  e.target.files,
                  (file) => uploadBanner.mutateAsync({ artist, file }),
                  "Banner updated"
                );
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={imageBusy}
              onClick={() => bannerInputRef.current?.click()}
            >
              {uploadBanner.isPending &&
              uploadBanner.variables?.artist.id === artist.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImagePlus className="size-3.5" />
              )}
              Image
            </Button>
            {BANNER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Use ${color} banner`}
                aria-pressed={
                  artist.banner_color === color && !artist.banner_color_end
                }
                disabled={imageBusy}
                onClick={() => {
                  void setBannerColor
                    .mutateAsync({ artist, color, colorEnd: null })
                    .catch((err) =>
                      setError(
                        err instanceof Error ? err.message : "Could not set banner."
                      )
                    );
                }}
                className={cn(
                  "size-5 rounded-[4px] border transition-colors",
                  artist.banner_color === color && !artist.banner_color_end
                    ? "border-text-hi/70"
                    : "border-line hover:border-text-lo",
                  imageBusy && "opacity-50"
                )}
                style={{ background: color }}
              />
            ))}
            <LookCustomBannerButton
              artist={artist}
              disabled={imageBusy}
              onCommit={(color, colorEnd) =>
                setBannerColor.mutateAsync({ artist, color, colorEnd })
              }
              onError={setError}
            />
            {artist.banner_url || artist.banner_color ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-text-lo hover:text-warn"
                disabled={imageBusy}
                onClick={() => {
                  void setBannerColor
                    .mutateAsync({ artist, color: null })
                    .then(() => toast("Banner cleared", "ok"))
                    .catch((err) =>
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Could not clear banner."
                      )
                    );
                }}
              >
                <X className="size-3.5" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {error ? <p role="alert" className="text-xs text-warn">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onFinish}
            disabled={busy || imageBusy}
            className="text-text-lo"
          >
            Skip for now
          </Button>
          <Button
            type="button"
            onClick={onFinish}
            disabled={busy || imageBusy}
            className="ml-auto rounded-full px-5"
          >
            Continue <ArrowRight className="size-4" />
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-text-lo/80">
          Skip keeps Spectra for now. You can set a look any time in Settings.
        </p>
      </div>
    </OriginScrim>
  );
}

/**
 * All three pieces of the look — banner, logo, profile mark — composed the way
 * they actually sit on an artist page, so one glance shows the whole thing.
 *
 * `shrink-0` is load-bearing. This is a flex child of a scrolling column, and
 * a flex item is allowed to shrink past its own `min-height`; with
 * `overflow-hidden` on top of that the strip silently collapsed to a sliver,
 * which is why only the banner was ever visible and the profile row was cut
 * off the bottom entirely. Fixed heights rather than an aspect ratio keep it
 * from swinging between a sliver and half the panel as the width changes.
 */
function LookPreview({ artist }: { artist: Artist }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-[12px] border border-line/70 bg-bg-2/25">
      <div className="relative h-28 w-full overflow-hidden sm:h-32">
        {artist.banner_url || artist.banner_color ? (
          <ArtistBanner artist={artist} className="absolute inset-0 size-full" />
        ) : (
          <div
            className="absolute inset-0 opacity-80"
            style={{
              background: `linear-gradient(125deg, color-mix(in oklab, var(--ice) 28%, transparent), color-mix(in oklab, var(--amber) 18%, transparent), transparent 70%)`,
            }}
            aria-hidden
          />
        )}
        {artist.logo_url ? (
          // Sits opposite the profile mark below, so the two never overlap.
          <div className="pointer-events-none absolute right-4 top-3 z-[1] flex h-[calc(100%-1.5rem)] w-[min(44%,11rem)] items-start justify-end">
            <SignedImage
              path={artist.logo_url}
              alt=""
              className="h-auto max-h-full w-auto max-w-full object-contain object-right drop-shadow-[0_10px_28px_rgb(0_0_0/0.5)]"
            />
          </div>
        ) : (
          <span className="pointer-events-none absolute right-4 top-4 z-[1] rounded-full border border-dashed border-white/25 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/45">
            Logo
          </span>
        )}
      </div>

      {/* Profile overlaps the banner edge, exactly as it does on the real page. */}
      <div className="relative flex items-end gap-3 px-3 pb-3">
        <div className="-mt-7 shrink-0">
          <ArtistMark
            emblemUrl={artist.emblem_url}
            paletteId={artist.palette_id}
            iceColor={artist.ice_color}
            amberColor={artist.amber_color}
            name={artist.name}
            size={56}
            className="size-14 shadow-e2 ring-2 ring-bg-0/90"
          />
        </div>
        <div className="min-w-0 pb-0.5">
          <p className="truncate font-display text-base font-semibold text-text-hi">
            {artist.name}
          </p>
          <p className="text-[11px] text-text-lo">Preview</p>
        </div>
      </div>
    </div>
  );
}

function LookUploadRow({
  label,
  hint,
  inputRef,
  busy,
  clearing,
  hasValue,
  disabled,
  onPick,
  onFile,
  onClear,
  preview,
}: {
  label: string;
  hint: string;
  inputRef: React.RefObject<HTMLInputElement>;
  busy: boolean;
  clearing: boolean;
  hasValue: boolean;
  disabled: boolean;
  onPick: () => void;
  onFile: (files: FileList | null) => void;
  onClear: () => void;
  preview?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[10px] border border-line/50 bg-bg-0/20 px-3 py-2.5">
      {preview ? <div className="shrink-0">{preview}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="min-w-0">
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-lo">
            {label}
          </span>
          <span className="ml-1.5 text-xs text-text-lo/80">({hint})</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onPick}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ImagePlus className="size-3.5" />
            )}
            {busy ? "Uploading…" : hasValue ? "Replace" : "Upload"}
          </Button>
          {hasValue ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-text-lo hover:text-warn"
              disabled={disabled}
              onClick={onClear}
            >
              {clearing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              {clearing ? "Removing…" : "Remove"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LookCustomAccentButton({
  artist,
  onCommit,
  onError,
}: {
  artist: Artist;
  onCommit: (ice: string, amber: string) => Promise<unknown>;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const accent = resolveArtistAccent(artist.palette_id, {
    ice: artist.ice_color,
    amber: artist.amber_color,
  });
  const [ice, setIce] = React.useState(accent.ice);
  const [amber, setAmber] = React.useState(accent.amber);
  const [saving, setSaving] = React.useState(false);
  const custom = hasCustomAccent(artist);

  React.useEffect(() => {
    if (!open) return;
    const next = resolveArtistAccent(artist.palette_id, {
      ice: artist.ice_color,
      amber: artist.amber_color,
    });
    setIce(next.ice);
    setAmber(next.amber);
  }, [open, artist.palette_id, artist.ice_color, artist.amber_color]);

  async function save() {
    setSaving(true);
    try {
      await onCommit(ice, amber);
      setOpen(false);
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Could not save custom colors. Run migration 022 if you haven't."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(custom && "text-ice")}
        onClick={() => setOpen(true)}
      >
        Custom
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Custom colors"
          description="Cool drives buttons and links. Warm is for emphasis markers."
          onClose={() => setOpen(false)}
        >
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-text-lo">
              Cool
              <HexColorInput
                value={ice}
                fallback={accent.ice}
                ariaLabel="Custom cool color"
                className="size-8 rounded-input"
                onCommit={setIce}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-text-lo">
              Warm
              <HexColorInput
                value={amber}
                fallback={accent.amber}
                ariaLabel="Custom warm color"
                className="size-8 rounded-input"
                onCommit={setAmber}
              />
            </label>
            <div
              className="h-8 flex-1 rounded-input border border-line"
              style={{
                background: `linear-gradient(135deg, ${ice} 0%, #ffffff 50%, ${amber} 100%)`,
              }}
              aria-hidden
            />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Apply"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LookCustomBannerButton({
  artist,
  disabled,
  onCommit,
  onError,
}: {
  artist: Artist;
  disabled?: boolean;
  onCommit: (
    color: string | null,
    colorEnd?: string | null
  ) => Promise<unknown>;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const startDefault = artist.banner_color ?? BANNER_COLORS[0];
  const endDefault =
    artist.banner_color_end ?? artist.banner_color ?? BANNER_COLORS[5];
  const [start, setStart] = React.useState(startDefault);
  const [end, setEnd] = React.useState(endDefault);
  const [useGradient, setUseGradient] = React.useState(!!artist.banner_color_end);
  const [saving, setSaving] = React.useState(false);
  const isCustom =
    !!artist.banner_color &&
    (!BANNER_COLORS.includes(
      artist.banner_color as (typeof BANNER_COLORS)[number]
    ) ||
      !!artist.banner_color_end);

  React.useEffect(() => {
    if (!open) return;
    setStart(artist.banner_color ?? BANNER_COLORS[0]);
    setEnd(artist.banner_color_end ?? artist.banner_color ?? BANNER_COLORS[5]);
    setUseGradient(!!artist.banner_color_end);
  }, [open, artist.banner_color, artist.banner_color_end]);

  async function save() {
    if (disabled) return;
    setSaving(true);
    try {
      await onCommit(start, useGradient ? end : null);
      setOpen(false);
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Could not save banner. Run migration 022 if you haven't."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        className={cn(isCustom && "text-ice")}
        onClick={() => setOpen(true)}
      >
        Custom
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Custom banner"
          description="Pick a wash color, or turn on Gradient for a two-stop blend."
          onClose={() => setOpen(false)}
        >
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-text-lo">
              Start
              <HexColorInput
                value={start}
                fallback={BANNER_COLORS[0]}
                ariaLabel="Banner start color"
                className="size-8 rounded-input"
                onCommit={setStart}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-text-lo">
              <input
                type="checkbox"
                checked={useGradient}
                onChange={(e) => setUseGradient(e.target.checked)}
                className="size-3.5 accent-[var(--ice)]"
              />
              Gradient
            </label>
            {useGradient ? (
              <label className="flex items-center gap-2 text-sm text-text-lo">
                End
                <HexColorInput
                  value={end}
                  fallback={BANNER_COLORS[5]}
                  ariaLabel="Banner end color"
                  className="size-8 rounded-input"
                  onCommit={setEnd}
                />
              </label>
            ) : null}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Apply"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
