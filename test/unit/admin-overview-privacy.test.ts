import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("admin overview privacy", () => {
  it("loads queue previews from allowlisted columns without ticket bodies or reported copy", () => {
    const route = read("app/api/admin/overview/route.ts");
    const select = read("lib/admin/select.ts");
    expect(select).toContain("OVERVIEW_SUPPORT_COLUMNS");
    expect(select).toContain("OVERVIEW_REPORT_COLUMNS");
    expect(select).toContain("OVERVIEW_AUDIT_COLUMNS");
    expect(route).toContain("OVERVIEW_SUPPORT_COLUMNS");
    expect(route).toContain("OVERVIEW_REPORT_COLUMNS");
    expect(route).not.toContain("SUPPORT_REPORT_COLUMNS");
    expect(route).not.toMatch(/(?<![A-Z_])REPORT_COLUMNS/);
    expect(select).toMatch(
      /OVERVIEW_SUPPORT_COLUMNS =\s*"id, email, category, subject, status, created_at, last_message_at"/
    );
    expect(select).not.toMatch(/OVERVIEW_SUPPORT_COLUMNS[\s\S]*details/);
  });
});
