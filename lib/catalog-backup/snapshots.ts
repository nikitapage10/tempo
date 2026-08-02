import { gunzipSync, gzipSync } from "zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCatalogDump,
  countCatalog,
} from "@/lib/catalog-backup/export";
import { detectCatalogDump } from "@/lib/catalog-backup/detect";
import { CATALOG_SCHEMA_VERSION, type CatalogDump, type CatalogSnapshotIndex, type CatalogSnapshotMeta } from "@/lib/catalog-backup/types";

const BUCKET = "audio";
const DAILY_KEEP = 14;
const WEEKLY_KEEP = 4;

export function catalogBackupPrefix(userId: string): string {
  return `catalog-backups/${userId}`;
}

export function catalogSnapshotObjectPath(
  userId: string,
  snapshotId: string,
): string {
  return `${catalogBackupPrefix(userId)}/${snapshotId}.json.gz`;
}

export function catalogIndexPath(userId: string): string {
  return `${catalogBackupPrefix(userId)}/index.json`;
}

function snapshotIdFromDate(d = new Date()): string {
  return d.toISOString().replace(/[:.]/g, "-");
}

async function downloadText(
  admin: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return await data.text();
}

async function downloadBytes(
  admin: SupabaseClient,
  path: string,
): Promise<ArrayBuffer | null> {
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return await data.arrayBuffer();
}

export async function readSnapshotIndex(
  admin: SupabaseClient,
  userId: string,
): Promise<CatalogSnapshotIndex> {
  const text = await downloadText(admin, catalogIndexPath(userId));
  if (!text) {
    return { userId, updatedAt: new Date().toISOString(), snapshots: [] };
  }
  try {
    const parsed = JSON.parse(text) as CatalogSnapshotIndex;
    if (!parsed || !Array.isArray(parsed.snapshots)) {
      return { userId, updatedAt: new Date().toISOString(), snapshots: [] };
    }
    return {
      userId,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      snapshots: parsed.snapshots,
    };
  } catch {
    return { userId, updatedAt: new Date().toISOString(), snapshots: [] };
  }
}

async function writeSnapshotIndex(
  admin: SupabaseClient,
  index: CatalogSnapshotIndex,
): Promise<void> {
  const body = JSON.stringify(index, null, 2);
  const path = catalogIndexPath(index.userId);
  const { error } = await admin.storage.from(BUCKET).upload(path, body, {
    upsert: true,
    contentType: "application/json",
    cacheControl: "0",
  });
  if (error) throw new Error(`Couldn’t write snapshot index: ${error.message}`);
}

export async function readCatalogSnapshot(
  admin: SupabaseClient,
  userId: string,
  snapshotId: string,
): Promise<CatalogDump | null> {
  const buf = await downloadBytes(
    admin,
    catalogSnapshotObjectPath(userId, snapshotId),
  );
  if (!buf) return null;
  let text: string;
  try {
    text = gunzipSync(Buffer.from(buf)).toString("utf8");
  } catch {
    text = Buffer.from(buf).toString("utf8");
  }
  const detected = detectCatalogDump(JSON.parse(text) as unknown);
  return detected.kind === "tempo-catalog" ? detected.dump : null;
}

export async function writeCatalogSnapshot(
  admin: SupabaseClient,
  userId: string,
  dump: CatalogDump,
  source: CatalogSnapshotMeta["source"] = "nightly",
): Promise<CatalogSnapshotMeta> {
  const id = snapshotIdFromDate(new Date(dump.exportedAt));
  const json = JSON.stringify(dump);
  const gz = gzipSync(Buffer.from(json, "utf8"));
  const path = catalogSnapshotObjectPath(userId, id);

  const { error } = await admin.storage.from(BUCKET).upload(path, gz, {
    upsert: true,
    contentType: "application/gzip",
    cacheControl: "0",
  });
  if (error) throw new Error(`Couldn’t store snapshot: ${error.message}`);

  const counts = countCatalog(dump.tables);
  const meta: CatalogSnapshotMeta = {
    id,
    createdAt: dump.exportedAt,
    schemaVersion: dump.schemaVersion || CATALOG_SCHEMA_VERSION,
    bytes: gz.length,
    source,
    ...counts,
  };

  const index = await readSnapshotIndex(admin, userId);
  index.snapshots = [
    meta,
    ...index.snapshots.filter((s) => s.id !== meta.id),
  ];
  index.updatedAt = new Date().toISOString();
  index.userId = userId;

  const pruned = pruneSnapshotList(index.snapshots);
  const removed = index.snapshots.filter(
    (s) => !pruned.some((p) => p.id === s.id),
  );
  index.snapshots = pruned;
  await writeSnapshotIndex(admin, index);

  for (const old of removed) {
    await admin.storage
      .from(BUCKET)
      .remove([catalogSnapshotObjectPath(userId, old.id)]);
  }

  return meta;
}

/** Keep 14 most recent daily + up to 4 weekly (oldest-of-week kept). */
export function pruneSnapshotList(
  snapshots: CatalogSnapshotMeta[],
): CatalogSnapshotMeta[] {
  const sorted = [...snapshots].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
  const daily = sorted.slice(0, DAILY_KEEP);
  const dailyIds = new Set(daily.map((s) => s.id));

  const byWeek = new Map<string, CatalogSnapshotMeta>();
  for (const s of sorted) {
    if (dailyIds.has(s.id)) continue;
    const week = s.createdAt.slice(0, 10);
    // ISO week-ish bucket by YYYY-WW from date
    const d = new Date(s.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const onejan = new Date(d.getUTCFullYear(), 0, 1);
    const weekNum = Math.ceil(
      ((d.getTime() - onejan.getTime()) / 86400000 + onejan.getUTCDay() + 1) /
        7,
    );
    const key = `${d.getUTCFullYear()}-W${weekNum}`;
    if (!byWeek.has(key)) byWeek.set(key, s);
  }

  const weekly = Array.from(byWeek.values())
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, WEEKLY_KEEP);

  const kept = [...daily, ...weekly];
  const seen = new Set<string>();
  return kept.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

export async function snapshotUserCatalog(
  admin: SupabaseClient,
  userId: string,
  source: CatalogSnapshotMeta["source"] = "nightly",
): Promise<CatalogSnapshotMeta> {
  const dump = await buildCatalogDump(admin, userId);
  return writeCatalogSnapshot(admin, userId, dump, source);
}

/** List auth users in pages for the nightly cron. */
export async function listAllUserIds(
  admin: SupabaseClient,
): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`Couldn’t list users: ${error.message}`);
    const users = data.users ?? [];
    for (const u of users) ids.push(u.id);
    if (users.length < 200) break;
    page += 1;
    if (page > 100) break; // safety
  }
  return ids;
}
