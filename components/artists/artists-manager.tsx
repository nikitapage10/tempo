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
import { GripVertical, ImagePlus, Plus, Trash2, X } from "lucide-react";
import {
  useActiveArtist,
  useArtistMutations,
} from "@/components/active-artist-provider";
import { ArtistMark } from "@/components/artists/artist-mark";
import { ArtistBanner } from "@/components/artists/artist-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  clearArtistLogo,
  countArtistContents,
  setArtistBannerColor,
  uploadArtistBanner,
  uploadArtistLogo,
} from "@/lib/api/artists";
import { ARTIST_PALETTES, BANNER_COLORS } from "@/lib/artist-theme";
import type { Artist } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ArtistsManager() {
  const { artists, activeArtistId, setActiveArtistId, isLoading } =
    useActiveArtist();
  const { create, rename, updatePalette, remove, reorder } =
    useArtistMutations();
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

  /** Real counts before a destructive delete — spaces and tracks go with it. */
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
        Each artist name you release under gets its own spaces, colours, logo
        and banner. Switch between them from the rail.
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
                    onAskDelete={() => handleAskDelete(artist.id)}
                    onCancelDelete={() => {
                      setConfirmId(null);
                      setCounts(null);
                    }}
                    onConfirmDelete={() => handleDelete(artist.id)}
                    onError={setError}
                    busy={busy}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-2 sm:flex-row">
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
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onError,
  busy,
}: {
  artist: Artist;
  isActive: boolean;
  confirmDelete: boolean;
  counts: { spaces: number; tracks: number } | null;
  canDelete: boolean;
  onRename: (id: string, name: string) => void;
  onPaletteChange: (id: string, paletteId: string) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onError: (message: string) => void;
  busy: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: artist.id });
  const [name, setName] = React.useState(artist.name);
  const [imageBusy, setImageBusy] = React.useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const bannerInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    setName(artist.name);
  }, [artist.name]);

  /** Shared guard for both image slots — same rule as a track cover. */
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
    setImageBusy(true);
    try {
      await action(file);
      toast(okMessage, "ok");
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Couldn’t upload that image — try a smaller file."
      );
    } finally {
      setImageBusy(false);
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
      <ArtistBanner artist={artist} className="h-12" />

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
            logoUrl={artist.logo_url}
            paletteId={artist.palette_id}
            name={artist.name}
            size={18}
            className="size-[18px]"
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

        {/* Palette — curated pairs only, so every artist keeps TEMPO's contrast. */}
        <div className="mt-2 flex flex-wrap items-center gap-1 pl-7">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-text-lo">
            Colour
          </span>
          {ARTIST_PALETTES.map((palette) => {
            const selected = artist.palette_id === palette.id;
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
        </div>

        {/* Logo + banner */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 pl-7">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-lo">
              Logo
            </span>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void withImage(
                  e.target.files,
                  (file) => uploadArtistLogo(artist, file),
                  "Logo updated"
                );
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
              <ImagePlus className="size-3.5" />
              {artist.logo_url ? "Replace" : "Upload"}
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
                    setImageBusy(true);
                    try {
                      await clearArtistLogo(artist);
                    } catch (err) {
                      onError(
                        err instanceof Error
                          ? err.message
                          : "Could not remove logo."
                      );
                    } finally {
                      setImageBusy(false);
                    }
                  })();
                }}
              >
                <X className="size-3.5" />
                Remove
              </Button>
            ) : null}
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
                  (file) => uploadArtistBanner(artist, file),
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
              <ImagePlus className="size-3.5" />
              Image
            </Button>
            {BANNER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Use ${color} banner`}
                aria-pressed={artist.banner_color === color}
                disabled={imageBusy}
                onClick={() => {
                  void (async () => {
                    setImageBusy(true);
                    try {
                      await setArtistBannerColor(artist, color);
                    } catch (err) {
                      onError(
                        err instanceof Error
                          ? err.message
                          : "Could not set banner."
                      );
                    } finally {
                      setImageBusy(false);
                    }
                  })();
                }}
                className={cn(
                  "size-5 rounded-[4px] border transition-colors duration-hover",
                  artist.banner_color === color
                    ? "border-text-hi/70"
                    : "border-line hover:border-text-lo"
                )}
                style={{ background: color }}
              />
            ))}
            {artist.banner_url || artist.banner_color ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-text-lo hover:text-warn"
                disabled={imageBusy}
                onClick={() => {
                  void (async () => {
                    setImageBusy(true);
                    try {
                      await setArtistBannerColor(artist, null);
                    } catch (err) {
                      onError(
                        err instanceof Error
                          ? err.message
                          : "Could not clear banner."
                      );
                    } finally {
                      setImageBusy(false);
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
            <Button type="button" variant="ghost" size="sm" onClick={onCancelDelete}>
              Cancel
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
