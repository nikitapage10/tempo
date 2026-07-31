"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { SignedImage } from "@/components/ui/signed-image";
import type { Post } from "@/lib/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ModerationReportDialog } from "@/components/social/moderation-report-dialog";

/** Turn @handles into links; leave the rest as plain text. */
export function renderPostBody(body: string) {
  const parts = body.split(/(@[a-z0-9_.]{3,30})/gi);
  return parts.map((part, i) => {
    if (/^@[a-z0-9_.]{3,30}$/i.test(part)) {
      const handle = part.slice(1).toLowerCase();
      return (
        <Link key={i} href={`/artist/${handle}`} className="text-ice hover:underline">
          {part}
        </Link>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export function FeedPostCard({
  post,
  onLike,
  onUnlike,
  onOpen,
  dense,
  myProfileId,
}: {
  post: Post;
  onLike: () => void;
  onUnlike: () => void;
  onOpen: () => void;
  dense?: boolean;
  myProfileId?: string | null;
}) {
  const author = post.author;
  const snap = post.attachment_snapshot;

  return (
    <article className={cn("panel-quiet p-4", dense && "p-3")}>
      <header className="flex items-start gap-3">
        <ArtistMark
          emblemUrl={author?.emblem_url ?? null}
          paletteId={author?.palette_id}
          iceColor={author?.ice_color}
          amberColor={author?.amber_color}
          name={author?.display_name ?? "Artist"}
          size={32}
          className="size-8"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {author?.handle ? (
              <Link
                href={`/artist/${author.handle}`}
                className="truncate text-sm font-medium text-text-hi hover:text-ice"
              >
                {author.display_name}
              </Link>
            ) : (
              <span className="truncate text-sm font-medium text-text-hi">
                {author?.display_name ?? "Artist"}
              </span>
            )}
            {author?.handle ? (
              <span className="text-xs text-text-lo">@{author.handle}</span>
            ) : null}
            <span className="text-xs text-text-lo">
              {formatShortDate(post.created_at)}
            </span>
          </div>
          {post.body ? (
            <button
              type="button"
              onClick={onOpen}
              className="mt-1.5 block w-full whitespace-pre-wrap text-left text-sm leading-relaxed text-text-hi"
            >
              {renderPostBody(post.body)}
            </button>
          ) : null}

          {post.media?.[0] ? (
            <button type="button" onClick={onOpen} className="mt-3 block w-full overflow-hidden rounded-card border border-line">
              <SignedImage
                path={post.media[0]}
                alt=""
                className="aspect-video w-full object-cover"
              />
            </button>
          ) : null}

          {snap ? (
            <div className="well mt-3 flex items-center gap-3 rounded-input p-2.5">
              {snap.artwork_url ? (
                <SignedImage
                  path={snap.artwork_url}
                  alt=""
                  className="size-10 shrink-0 rounded-input object-cover"
                />
              ) : (
                <div className="size-10 shrink-0 rounded-input bg-bg-2" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm text-text-hi">{snap.title}</p>
                {snap.artist_name ? (
                  <p className="truncate text-xs text-text-lo">{snap.artist_name}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => (post.liked_by_me ? onUnlike() : onLike())}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors",
                post.liked_by_me ? "text-amber" : "text-text-lo hover:text-text-hi"
              )}
            >
              <Heart
                className="size-3.5"
                fill={post.liked_by_me ? "currentColor" : "none"}
              />
              {post.like_count}
            </button>
            <button
              type="button"
              onClick={onOpen}
              className="flex items-center gap-1.5 text-xs text-text-lo hover:text-text-hi"
            >
              <MessageCircle className="size-3.5" />
              {post.comment_count}
            </button>
            {myProfileId && myProfileId !== post.author_profile_id ? <ModerationReportDialog reporterProfileId={myProfileId} targetType="post" targetId={post.id} compact /> : null}
          </div>
        </div>
      </header>
    </article>
  );
}
