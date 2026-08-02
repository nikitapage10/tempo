import type { CatalogRestoreSummary, CatalogSnapshotMeta } from "@/lib/catalog-backup/types";

export type CatalogPreview = {
  preview: true;
  normalized: boolean;
  exportedAt: string;
  schemaVersion: number;
  summary: string;
  notes: string[];
  counts: Record<string, number>;
};

export type CatalogImportResult = {
  ok: true;
  normalized: boolean;
  summary: string;
  result: CatalogRestoreSummary;
};

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    /* ignore */
  }
  return "Something went wrong. Try again.";
}

/** Trigger a browser download of the live catalog export. */
export async function downloadCatalogExport(): Promise<void> {
  const res = await fetch("/api/catalog/export");
  if (!res.ok) throw new Error(await readError(res));
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? "tempo-catalog.json";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function previewCatalogImport(
  text: string,
  allowNormalize: boolean,
): Promise<CatalogPreview> {
  const res = await fetch("/api/catalog/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, preview: true, allowNormalize }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as CatalogPreview;
}

export async function confirmCatalogImport(
  text: string,
  allowNormalize: boolean,
): Promise<CatalogImportResult> {
  const res = await fetch("/api/catalog/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, confirm: true, allowNormalize }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as CatalogImportResult;
}

export async function listCatalogSnapshots(): Promise<CatalogSnapshotMeta[]> {
  const res = await fetch("/api/catalog/snapshots");
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { snapshots: CatalogSnapshotMeta[] };
  return body.snapshots ?? [];
}

export async function saveCatalogSnapshotNow(): Promise<CatalogSnapshotMeta> {
  const res = await fetch("/api/catalog/snapshots", { method: "POST" });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { snapshot: CatalogSnapshotMeta };
  return body.snapshot;
}

export async function downloadCatalogSnapshot(id: string): Promise<void> {
  const res = await fetch(`/api/catalog/snapshots/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await readError(res));
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? `tempo-snapshot-${id}.json`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function restoreCatalogSnapshot(id: string): Promise<CatalogRestoreSummary> {
  const res = await fetch(`/api/catalog/snapshots/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { result: CatalogRestoreSummary };
  return body.result;
}
