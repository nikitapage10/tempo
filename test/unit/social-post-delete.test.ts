import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Social post deletion", () => {
  const migration = readFileSync(
    join(process.cwd(), "migrations/079_delete_own_social_post.sql"),
    "utf8"
  );

  it("only soft-deletes the signed-in user's own non-Scene post", () => {
    expect(migration).toContain("author_user_id = auth.uid()");
    expect(migration).toContain("scene_id is null");
    expect(migration).toContain("deleted_at is null");
    expect(migration).toContain("return v_removed > 0");
  });
});
