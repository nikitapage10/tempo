"use client";

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  useActiveArtist,
  useArtistMutations,
} from "@/components/active-artist-provider";
import { ArtistMark } from "@/components/artists/artist-mark";
import { ArtistBanner } from "@/components/artists/artist-banner";
import { HexColorInput } from "@/components/artists/hex-color-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { SignedImage } from "@/components/ui/signed-image";
import { countArtistContents } from "@/lib/api/artists";
import {
  ARTIST_PALETTES,
  BANNER_COLORS,
  hasCustomAccent,
  resolveArtistAccent,
} from "@/lib/artist-theme";
import type { Artist } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ArtistsManager() {
  const { artists, activeArtistId, setActiveArtistId, isLoading } =
    useActiveArtist();
  const {
    create,
    rename,
    updatePalette,
    setCustomAccent,
    remove,
    reorder,
    uploadLogo,
    clearLogo,
    uploadEmblem,
    clearEmblem,
    uploadBanner,
    setBannerColor,
  } = useArtistMutations();
  const [newName, setNewName] = React.useState("");
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [counts, setCounts] = React.useState<{
    spaces: number;
    tracks: number;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const artist = await create.mutateAsync({
        name: newName.trim(),
        sort: artists.length,
      });
      setNewName("");
      setActiveArtistId(artist.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add artist.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string, name: string) {
    try {
      await rename.mutateAsync({ id, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename artist.");
    }
  }

  /** Real counts before a destructive-delete confirmation. */
  async function handleAskDelete(id: string) {
    setConfirmId(id);
    setCounts(null);
    try {
      setCounts(await countArtistContents(id));
    } catch {
      /* confirm still shows, just without exact numbers */
    }
  }

  async function handleDelete(id: string) {
    if (artists.length <= 1) {
      setError("Keep at least one artist.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await remove.mutateAsync(id);
      setConfirmId(null);
      setCounts(null);
      if (activeArtistId === id) {
        const next = artists.find((a) => a.id !== id);
        if (next) setActiveArtistId(next.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete artist.");
    } finally {
      setBusy(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = artists.findIndex((a) => a.id === active.id);
    const newIndex = artists.findIndex((a) => a.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(artists, oldIndex, newIndex).map((a, i) => ({
      id: a.id,
      sort: i,
    }));
    reorder.mutate(next);
  }

  return (
    <section
      id="artists"
      className="scroll-mt-8 rounded-card border border-line bg-bg-1 p-5"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
        Artists
      </p>
      <p className="mt-2 text-sm text-text-lo">
        Each artist name you release under gets its own spaces, colors, logo,
        profile image and banner. Switch between them from the rail.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-text-lo">Loading artists…</p>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={artists.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="mt-4 space-y-3">
                {artists.map((artist) => (
                  <SortableArtistRow
                    key={artist.id}
                    artist={artist}
                    isActive={artist.id === activeArtistId}
                    confirmDelete={confirmId === artist.id}
                    counts={confirmId === artist.id ? counts : null}
                    canDelete={artists.length > 1}
                    onRename={handleRename}
                    onPaletteChange={(id, paletteId) =>
                      updatePalette.mutate({ id, paletteId })
                    }
                    onCustomAccent={(ice, amber) =>
                      setCustomAccent.mutateAsync({ artist, ice, amber })
                    }
                    onAskDelete={() => handleAskDelete(artist.id)}
                    onCancelDelete={() => {
                      setConfirmId(null);
                      setCounts(null);
                    }}
                    onConfirmDelete={() => handleDelete(artist.id)}
                    onError={setError}
                    busy={busy}
                    onUploadBanner={(file) =>
                      uploadBanner.mutateAsync({ artist, file })
                    }
                    onUploadLogo={(file) =>
                      uploadLogo.mutateAsync({ artist, file })
                    }
                    onClearLogo={() => clearLogo.mutateAsync(artist)}
                    onUploadEmblem={(file) =>
                      uploadEmblem.mutateAsync({ artist, file })
                    }
                    onClearEmblem={() => clearEmblem.mutateAsync(artist)}
                    onSetBannerColor={(color, colorEnd) =>
                      setBannerColor.mutateAsync({ artist, color, colorEnd })
                    }
                    logoBusy={
                      uploadLogo.isPending &&
                      uploadLogo.variables?.artist.id === artist.id
                    }
                    emblemBusy={
                      (uploadEmblem.isPending &&
                        uploadEmblem.variables?.artist.id === artist.id) ||
                      (clearEmblem.isPending &&
                        clearEmblem.variables?.id === artist.id)
                    }
                    bannerBusy={
                      (uploadBanner.isPending &&
                        uploadBanner.variables?.artist.id === artist.id) ||
                      (setBannerColor.isPending &&
                        setBannerColor.variables?.artist.id === artist.id)
                    }
                    clearLogoBusy={
                      clearLogo.isPending &&
                      clearLogo.variables?.id === artist.id
                    }
                    bannerUploading={
                      uploadBanner.isPending &&
                      uploadBanner.variables?.artist.id === artist.id
                    }
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <form
            onSubmit={handleCreate}
            className="mt-4 flex flex-col gap-2 sm:flex-row"
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New artist name"
              maxLength={60}
              className="flex-1"
            />
            <Button type="submit" disabled={busy || !newName.trim()}>
              <Plus className="size-3.5" />
              Add
            </Button>
          </form>
        </>
      )}

      {error ? <p className="mt-3 text-sm text-warn">{error}</p> : null}
    </section>
  );
}

function SortableArtistRow({
  artist,
  isActive,
  confirmDelete,
  counts,
  canDelete,
  onRename,
  onPaletteChange,
  onCustomAccent,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onError,
  busy,
  onUploadLogo,
  onUploadEmblem,
  onUploadBanner,
  onClearLogo,
  onClearEmblem,
  onSetBannerColor,
  logoBusy,
  emblemBusy,
  bannerBusy,
  clearLogoBusy,
  bannerUploading,
}: {
  artist: Artist;
  isActive: boolean;
  confirmDelete: boolean;
  counts: { spaces: number; tracks: number } | null;
  canDelete: boolean;
  onRename: (id: string, name: string) => void;
  onPaletteChange: (id: string, paletteId: string) => void;
  onCustomAccent: (ice: string, amber: string) => Promise<unknown>;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onError: (message: string) => void;
  busy: boolean;
  onUploadLogo: (file: File) => Promise<unknown>;
  onUploadEmblem: (file: File) => Promise<unknown>;
  onUploadBanner: (file: File) => Promise<unknown>;
  onClearLogo: () => Promise<unknown>;
  onClearEmblem: () => Promise<unknown>;
  onSetBannerColor: (
    color: string | null,
    colorEnd?: string | null
  ) => Promise<unknown>;
  logoBusy: boolean;
  emblemBusy: boolean;
  bannerBusy: boolean;
  clearLogoBusy: boolean;
  bannerUploading: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: artist.id });
  const [name, setName] = React.useState(artist.name);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const emblemInputRef = React.useRef<HTMLInputElement>(null);
  const bannerInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const imageBusy = logoBusy || emblemBusy || bannerBusy || clearLogoBusy;

  React.useEffect(() => {
    setName(artist.name);
  }, [artist.name]);

  async function withImage(
    files: FileList | null,
    action: (file: File) => Promise<unknown>,
    okMessage: string
  ) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("Pick an image file (png, jpg, webp).");
      return;
    }
    try {
      await action(file);
      toast(okMessage, "ok");
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Couldn’t upload that image — try a smaller file."
      );
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "overflow-hidden rounded-input border border-line bg-bg-2",
        isActive && "border-ice/35",
        isDragging && "ring-1 ring-ice/50"
      )}
    >
      <div className={cn("relative h-20 sm:h-24", bannerBusy && "opacity-90")}>
        {artist.banner_url || artist.banner_color ? (
          <ArtistBanner artist={artist} className="absolute inset-0 size-full" />
        ) : (
          <div className="absolute inset-0 bg-bg-3" aria-hidden />
        )}
        {artist.logo_url ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] flex w-[50%] items-end justify-end p-1.5">
            <SignedImage
              path={artist.logo_url}
              alt=""
              className="max-h-[85%] w-auto max-w-full object-contain object-right-bottom"
            />
          </div>
        ) : null}
        {bannerBusy ? (
          <div
            className="absolute inset-0 z-[2] flex items-center justify-center bg-bg-0/35"
            aria-hidden
          >
            <Loader2 className="size-4 animate-spin text-ice" />
          </div>
        ) : null}
      </div>

      <div className="px-2 py-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab touch-none p-1 text-text-lo active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <ArtistMark
            emblemUrl={artist.emblem_url}
            paletteId={artist.palette_id}
            iceColor={artist.ice_color}
            amberColor={artist.amber_color}
            name={artist.name}
            size={28}
            className={cn("size-7", emblemBusy && "opacity-50")}
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            onBlur={() => {
              if (name.trim() && name.trim() !== artist.name) {
                onRename(artist.id, name.trim());
              } else {
                setName(artist.name);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-8 border-transparent bg-transparent px-1 focus-visible:border-line focus-visible:bg-bg-0"
          />
          {isActive ? (
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-amber">
              Active
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-text-lo hover:text-warn"
            disabled={!canDelete}
            onClick={onAskDelete}
            aria-label={`Delete ${artist.name}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1 pl-7">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-text-lo">
            Color
          </span>
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
                onClick={() => onPaletteChange(artist.id, palette.id)}
                className={cn(
                  "size-5 rounded-full border transition-colors duration-hover",
                  selected
                    ? "border-text-hi/70"
                    : "border-line hover:border-text-lo"
                )}
                style={{
                  background: `linear-gradient(135deg, ${palette.ice} 0%, #ffffff 50%, ${palette.amber} 100%)`,
                }}
              />
            );
          })}
          <CustomAccentDialogButton
            artist={artist}
            onCommit={onCustomAccent}
            onError={onError}
          />
        </div>

        <div className="mt-2 flex flex-col gap-2 pl-7">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-lo">
                Logo
              </span>
              <span className="hidden text-[11px] text-text-lo sm:inline">
                (wide — Today)
              </span>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void withImage(e.target.files, onUploadLogo, "Logo updated");
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={imageBusy}
                onClick={() => logoInputRef.current?.click()}
              >
                {logoBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
                {logoBusy
                  ? "Uploading…"
                  : artist.logo_url
                    ? "Replace"
                    : "Upload"}
              </Button>
              {artist.logo_url ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-text-lo hover:text-warn"
                  disabled={imageBusy}
                  onClick={() => {
                    void (async () => {
                      try {
                        await onClearLogo();
                        toast("Logo removed", "ok");
                      } catch (err) {
                        onError(
                          err instanceof Error
                            ? err.message
                            : "Could not remove logo."
                        );
                      }
                    })();
                  }}
                >
                  {clearLogoBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                  {clearLogoBusy ? "Removing…" : "Remove"}
                </Button>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-lo">
                Profile image
              </span>
              <span className="hidden text-[11px] text-text-lo sm:inline">
                (photo or emblem)
              </span>
              <input
                ref={emblemInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void withImage(
                    e.target.files,
                    onUploadEmblem,
                    "Profile image updated"
                  );
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={imageBusy}
                onClick={() => emblemInputRef.current?.click()}
              >
                {emblemBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
                {emblemBusy
                  ? "Uploading…"
                  : artist.emblem_url
                    ? "Replace"
                    : "Upload"}
              </Button>
              {artist.emblem_url ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-text-lo hover:text-warn"
                  disabled={imageBusy}
                  onClick={() => {
                    void (async () => {
                      try {
                        await onClearEmblem();
                        toast("Profile image removed", "ok");
                      } catch (err) {
                        onError(
                          err instanceof Error
                            ? err.message
                            : "Could not remove profile image."
                        );
                      }
                    })();
                  }}
                >
                  <X className="size-3.5" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-lo">
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
                  onUploadBanner,
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
              {bannerUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImagePlus className="size-3.5" />
              )}
              {bannerUploading ? "Uploading…" : "Image"}
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
                  void (async () => {
                    try {
                      await onSetBannerColor(color, null);
                    } catch (err) {
                      onError(
                        err instanceof Error
                          ? err.message
                          : "Could not set banner."
                      );
                    }
                  })();
                }}
                className={cn(
                  "size-5 rounded-[4px] border transition-colors duration-hover",
                  artist.banner_color === color && !artist.banner_color_end
                    ? "border-text-hi/70"
                    : "border-line hover:border-text-lo",
                  imageBusy && "opacity-50"
                )}
                style={{ background: color }}
              />
            ))}
            <CustomBannerDialogButton
              artist={artist}
              disabled={imageBusy}
              onCommit={onSetBannerColor}
              onError={onError}
            />
            {artist.banner_url || artist.banner_color ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-text-lo hover:text-warn"
                disabled={imageBusy}
                onClick={() => {
                  void (async () => {
                    try {
                      await onSetBannerColor(null);
                      toast("Banner cleared", "ok");
                    } catch (err) {
                      onError(
                        err instanceof Error
                          ? err.message
                          : "Could not clear banner."
                      );
                    }
                  })();
                }}
              >
                <X className="size-3.5" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {confirmDelete ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line px-1 pt-2 pb-1">
            <span className="text-xs text-warn">
              {counts
                ? `Deletes this artist, its ${counts.spaces} ${
                    counts.spaces === 1 ? "space" : "spaces"
                  }, and ${counts.tracks} ${
                    counts.tracks === 1 ? "track" : "tracks"
                  } inside. Sure?`
                : "Deletes this artist, its spaces, and all tracks inside. Sure?"}
            </span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={onConfirmDelete}
            >
              Yes, delete
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelDelete}
            >
              Cancel
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function CustomAccentDialogButton({
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
          : "Could not save custom colors — run migration 022 if you haven't."
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
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

function CustomBannerDialogButton({
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
  const [useGradient, setUseGradient] = React.useState(
    !!artist.banner_color_end
  );
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
    setEnd(
      artist.banner_color_end ?? artist.banner_color ?? BANNER_COLORS[5]
    );
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
          : "Could not save banner — run migration 022 if you haven't."
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
          <div
            className="mt-4 h-16 rounded-card border border-line"
            style={{
              background: useGradient
                ? `linear-gradient(125deg, ${start} 0%, ${end} 42%, rgb(10 10 12 / 0.65) 72%, var(--bg-0) 100%)`
                : `linear-gradient(180deg, ${start} 0%, rgb(10 10 12 / 0.65) 70%, var(--bg-0) 100%)`,
            }}
            aria-hidden
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || disabled}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Apply"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
