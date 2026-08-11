import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("Admin invite deletion", () => {
  it("provides an admin-only permanent delete endpoint with an audit event", () => {
    const route = read("app/api/admin/invites/[id]/route.ts");
    expect(route).toContain("export async function DELETE");
    expect(route).toContain("await requireAdmin()");
    expect(route).toContain('.from("invites")');
    expect(route).toContain(".delete()");
    expect(route).toContain('"invite.deleted"');
  });

  it("keeps revoke and permanent removal as separate admin actions", () => {
    const page = read("app/admin/invites/page.tsx");
    const hook = read("hooks/use-admin.ts");
    expect(page).toContain('aria-label="Revoke invite"');
    expect(page).toContain('aria-label="Delete invite from history"');
    expect(page).toContain("Delete invite from history?");
    expect(hook).toContain("mutationFn: deleteAdminInvite");
  });
});
