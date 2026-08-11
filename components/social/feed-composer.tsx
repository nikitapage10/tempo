"use client";

import * as React from "react";
import { ImagePlus, Music2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFeedMutations } from "@/hooks/use-feed";
import { createClient } from "@/lib/supabase/client";
import { buildPostMediaPath, uploadFile } from "@/lib/storage";
import type { PostVisibility, Track } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FeedComposer({
  myProfileId,
  className,
}: {
  myProfileId: string | null;
  className?: string;
}) {
  const { create } = useFeedMutations(myProfileId);
  const [body, setBody] = React.useState("");
  const [visibility, setVisibility] = React.useState<PostVisibility>("followers");
  const [trackId, setTrackId] = React.useState<string | null>(null);
  const [tracks, setTracks] = React.useState<Pick<Track, "id" | "title">[]>([]);
  const [showTracks, setShowTracks] = React.useState(false);
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  // Collapsed = a one-line prompt; expanded reveals visibility/image/track/post.
  // Stays expanded once there's anything to lose (text, an image, a track).
  const [expanded, setExpanded] = React.useState(false);
  const hasDraft = !!body.trim() || !!imageFile || !!trackId;

  React.useEffect(() => {
    if (!showTracks) return;
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase
        .from("tracks")
        .select("id, title")
        .order("updated_at", { ascending: false })
        .limit(40);
      setTracks((data as Pick<Track, "id" | "title">[]) ?? []);
    })();
  }, [showTracks]);

  React.useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  function clearImage() {
    setImageFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function openImagePicker() {
    if (!fileRef.current) return;
    // Clearing the native value lets an artist choose the same file again.
    fileRef.current.value = "";
    fileRef.current.click();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!myProfileId) return;
    const trimmed = body.trim();
    if (!trimmed && !imageFile && !trackId) return;
    setError(null);
    try {
      let media: string[] = [];
      if (imageFile) {
        const tempId = crypto.randomUUID();
        const path = buildPostMediaPath({
          profileId: myProfileId,
          postId: tempId,
          filename: imageFile.name,
        });
        await uploadFile(path, imageFile, { contentType: imageFile.type });
        media = [path];
      }
      await create.mutateAsync({
        body: trimmed,
        media,
        trackId,
        visibility,
      });
      setBody("");
      setTrackId(null);
      clearImage();
      setShowTracks(false);
      setExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post — try again.");
    }
  }

  if (!myProfileId) {
    return (
      <div className={cn("panel-quiet p-4 text-sm text-text-lo", className)}>
        Set up your Artist profile first — posts are signed with that identity.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "panel space-y-3 transition-[padding] duration-150",
        expanded ? "p-4" : "p-2.5",
        className
      )}
    >
      <Textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => setExpanded(true)}
        placeholder="Share an update…"
        maxLength={5000}
        rows={expanded ? 3 : 1}
        className={cn(
          "resize-y transition-[min-height] duration-150",
          expanded ? "min-h-[4.5rem]" : "min-h-0 resize-none py-1.5"
        )}
      />
      {expanded ? (
        <>
          {imageFile && imagePreviewUrl ? (
            <div className="overflow-hidden rounded-card border border-line bg-bg-1 shadow-e1">
              <div className="relative aspect-video overflow-hidden bg-bg-0">
                {/* A blob URL is the exact local file the artist selected; it
                    is revoked whenever the attachment changes or unmounts. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl}
                  alt={`Preview of ${imageFile.name}`}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  aria-label="Remove attached image"
                  title="Remove image"
                  className="absolute right-2 top-2 grid size-7 place-items-center rounded-full border border-white/15 bg-black/65 text-white/80 backdrop-blur transition-colors hover:bg-black/85 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="flex min-w-0 items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-xs text-text-lo">
                  {imageFile.name}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-xs text-ice hover:underline"
                  onClick={openImagePicker}
                >
                  Replace
                </button>
                <button
                  type="button"
                  className="shrink-0 text-xs text-text-lo hover:text-warn"
                  onClick={clearImage}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}
          {trackId ? (
            <p className="text-xs text-text-lo">
              Attached: {tracks.find((t) => t.id === trackId)?.title ?? "track"}{" "}
              <button
                type="button"
                className="text-ice hover:underline"
                onClick={() => setTrackId(null)}
              >
                remove
              </button>
            </p>
          ) : null}
          {showTracks ? (
            <div className="well max-h-40 overflow-y-auto rounded-input p-2">
              {tracks.length === 0 ? (
                <p className="px-2 py-1 text-xs text-text-lo">No tracks yet</p>
              ) : (
                tracks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="block w-full truncate rounded-input px-2 py-1.5 text-left text-sm text-text-hi hover:bg-bg-2"
                    onClick={() => {
                      setTrackId(t.id);
                      setShowTracks(false);
                    }}
                  >
                    {t.title}
                  </button>
                ))
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as PostVisibility)}
              className="rounded-input border border-line bg-bg-2 px-2 py-1.5 text-xs text-text-hi"
            >
              <option value="followers">Followers</option>
              <option value="members">TEMPO members</option>
              <option value="public">Public</option>
            </select>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={openImagePicker}
            >
              <ImagePlus className="size-3.5" />
              Image
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowTracks((v) => !v)}
            >
              <Music2 className="size-3.5" />
              Track
            </Button>
            <div className="flex-1" />
            {!hasDraft ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowTracks(false);
                  setExpanded(false);
                }}
              >
                Cancel
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={create.isPending}>
              <Send className="size-3.5" />
              Post
            </Button>
          </div>
          {error ? <p className="text-xs text-warn">{error}</p> : null}
        </>
      ) : null}
    </form>
  );
}
