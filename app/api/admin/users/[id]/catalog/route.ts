import { type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { adminError, adminJson } from "@/lib/admin/http";
import {
  buildCatalogDump,
  catalogFilename,
} from "@/lib/catalog-backup/export";
import { readSnapshotIndex } from "@/lib/catalog-backup/snapshots";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: { id: string } };

/**
 * GET /api/admin/users/[id]/catalog
 * ?download=1 — stream a fresh metadata export
 * default — list automatic snapshots for support restore
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const access = await requireAdmin();
  if (!access) return adminError("Forbidden.", 403);

  const download = req.nextUrl.searchParams.get("download") === "1";
  try {
    const service = createAdminClient();
    const { data } = await service.auth.admin.getUserById(params.id);
    if (!data.user) return adminError("Member not found.", 404);

    if (download) {
      const dump = await buildCatalogDump(service, params.id);
      await logAdminAction(
        access.user.id,
        "member.catalog_exported",
        { type: "user", id: params.id },
        { exportedAt: dump.exportedAt },
      );
      const body = JSON.stringify(dump, null, 2);
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${catalogFilename(new Date(dump.exportedAt))}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const index = await readSnapshotIndex(service, params.id);
    return adminJson({
      userId: params.id,
      snapshots: index.snapshots,
      updatedAt: index.updatedAt,
    });
  } catch (err) {
    console.error("[admin/catalog]", err);
    return adminError("Couldn’t load catalog backups.", 500);
  }
}
