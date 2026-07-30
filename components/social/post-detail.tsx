"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FeedPostCard, renderPostBody } from "@/components/social/feed-post";
import { ArtistMark } from "@/components/artists/artist-mark";
import { useFeedMutations, usePost, usePostComments } from "@/hooks/use-feed";
import { formatShortDate } from "@/lib/format";

export function PostDetailDialog({
  postId,
  myProfileId,
  open,
  onOpenChange,
}: {
  postId: string | null;
  myProfileId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: post } = usePost(open ? postId : null, myProfileId);
  const { data: comments = [] } = usePostComments(open ? postId : null);
  const { like, unlike, comment } = useFeedMutations(myProfileId);
  const [body, setBody] = React.useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Post"
        onClose={() => onOpenChange(false)}
        className="max-w-lg"
      >
        {post ? (
          <div className="space-y-4">
            <FeedPostCard
              post={post}
              onLike={() => like.mutate(post.id)}
              onUnlike={() => unlike.mutate(post.id)}
              onOpen={() => {}}
            />
            <div className="space-y-2">
              <p className="label-mono">Comments</p>
              {comments.length === 0 ? (
                <p className="text-sm text-text-lo">No comments yet</p>
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto">
                  {comments.map((c) => (
                    <li key={c.id} className="flex gap-2">
                      <ArtistMark
                        emblemUrl={c.author?.emblem_url ?? null}
                        paletteId={c.author?.palette_id}
                        name={c.author?.display_name ?? "Artist"}
                        size={16}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-text-lo">
                          {c.author?.display_name} · {formatShortDate(c.created_at)}
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-text-hi">
                          {renderPostBody(c.body)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {myProfileId ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!body.trim()) return;
                    comment.mutate(
                      { postId: post.id, body },
                      { onSuccess: () => setBody("") }
                    );
                  }}
                >
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Reply…"
                    rows={2}
                    className="flex-1"
                    maxLength={2000}
                  />
                  <Button type="submit" size="sm" disabled={comment.isPending}>
                    Send
                  </Button>
                </form>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-lo">Loading…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
