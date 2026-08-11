import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("Social post editing", () => {
  it("limits the edit action to the signed-in post owner", () => {
    const card = read("components/social/feed-post.tsx");
    expect(card).toContain("myProfileId === post.author_profile_id");
    expect(card).toContain('aria-label="Edit your post"');
    expect(card).toContain('aria-label="Edit post"');
    expect(card).toContain("Save changes");
  });

  it("updates the owned home-feed post and refreshes its mentions", () => {
    const api = read("lib/api/feed.ts");
    expect(api).toContain("export async function editSocialPost");
    expect(api).toContain('.eq("author_user_id", user.id)');
    expect(api).toContain('.is("scene_id", null)');
    expect(api).toContain('.from("post_mentions")');
    expect(api).toContain("extractHandles(trimmed)");
  });

  it("optimistically updates both the feed and open detail", () => {
    const hook = read("hooks/use-feed.ts");
    expect(hook).toContain("const edit = useMutation");
    expect(hook).toContain('queryKey: ["home-timeline"]');
    expect(hook).toContain('qc.setQueryData<Post | null>(["post", postId]');
    expect(hook).toContain("return { create, edit, remove, like, unlike, comment }");
  });
});
