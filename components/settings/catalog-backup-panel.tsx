"use client";

import * as React from "react";
import { Download, History, RotateCcw, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  confirmCatalogImport,
  downloadCatalogExport,
  downloadCatalogSnapshot,
  listCatalogSnapshots,
  previewCatalogImport,
  restoreCatalogSnapshot,
  saveCatalogSnapshotNow,
  type CatalogPreview,
} from "@/lib/api/catalog-backup";
import type { CatalogSnapshotMeta } from "@/lib/catalog-backup/types";
import { cn } from "@/lib/utils";

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function CatalogBackupPanel() {
  const { toast } = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = React.useState(false);
  const [savingSnap, setSavingSnap] = React.useState(false);
  const [loadingSnaps, setLoadingSnaps] = React.useState(true);
  const [snapshots, setSnapshots] = React.useState<CatalogSnapshotMeta[]>([]);
  const [allowNormalize, setAllowNormalize] = React.useState(true);
  const [preview, setPreview] = React.useState<CatalogPreview | null>(null);
  const [pendingText, setPendingText] = React.useState<string | null>(null);
  const [busyImport, setBusyImport] = React.useState(false);
  const [restoreSnapId, setRestoreSnapId] = React.useState<string | null>(null);
  const [busyRestoreSnap, setBusyRestoreSnap] = React.useState(false);

  const refreshSnapshots = React.useCallback(async () => {
    setLoadingSnaps(true);
    try {
      setSnapshots(await listCatalogSnapshots());
    } catch {
      setSnapshots([]);
    } finally {
      setLoadingSnaps(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshSnapshots();
  }, [refreshSnapshots]);

  async function onExport() {
    setExporting(true);
    try {
      await downloadCatalogExport();
      toast("Catalog downloaded.", "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t export.");
    } finally {
      setExporting(false);
    }
  }

  async function onSaveSnapshot() {
    setSavingSnap(true);
    try {
      await saveCatalogSnapshotNow();
      toast("Snapshot saved.", "ok");
      await refreshSnapshots();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t save snapshot.");
    } finally {
      setSavingSnap(false);
    }
  }

  async function onPickFile(file: File | null) {
    if (!file) return;
    setBusyImport(true);
    try {
      const text = await file.text();
      const next = await previewCatalogImport(text, allowNormalize);
      setPendingText(text);
      setPreview(next);
    } catch (e) {
      setPreview(null);
      setPendingText(null);
      toast(e instanceof Error ? e.message : "Couldn’t read that file.");
    } finally {
      setBusyImport(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onConfirmImport() {
    if (!pendingText) return;
    setBusyImport(true);
    try {
      const result = await confirmCatalogImport(pendingText, allowNormalize);
      const inserted = Object.values(result.result.inserted).reduce(
        (a, b) => a + (b ?? 0),
        0,
      );
      toast(
        inserted
          ? `Restored ${inserted} rows into your catalog.`
          : "Nothing new to add — those rows were already there.",
        "ok",
      );
      setPreview(null);
      setPendingText(null);
      await refreshSnapshots();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t restore.");
    } finally {
      setBusyImport(false);
    }
  }

  async function onConfirmRestoreSnap() {
    if (!restoreSnapId) return;
    setBusyRestoreSnap(true);
    try {
      const result = await restoreCatalogSnapshot(restoreSnapId);
      const inserted = Object.values(result.inserted).reduce(
        (a, b) => a + (b ?? 0),
        0,
      );
      toast(
        inserted
          ? `Restored ${inserted} rows from that snapshot.`
          : "Nothing new to add — those rows were already there.",
        "ok",
      );
      setRestoreSnapId(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t restore snapshot.");
    } finally {
      setBusyRestoreSnap(false);
    }
  }

  return (
    <section id="your-data" className="panel scroll-mt-24 p-5">
      <p className="label-mono">Your data</p>
      <p className="mt-2 text-sm text-text-lo">
        Export your catalog metadata anytime, restore from a file, or roll back
        to an automatic snapshot. Audio bounces stay in your own archives —
        this covers titles, notes, projects, tasks, and the rest of the text.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={exporting}
          onClick={() => void onExport()}
        >
          <Download className="mr-1.5 size-3.5" />
          {exporting ? "Preparing…" : "Export catalog"}
        </Button>
        <Button
          variant="secondary"
          disabled={busyImport}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-1.5 size-3.5" />
          {busyImport ? "Reading…" : "Restore from file"}
        </Button>
        <Button
          variant="ghost"
          disabled={savingSnap}
          onClick={() => void onSaveSnapshot()}
        >
          <Save className="mr-1.5 size-3.5" />
          {savingSnap ? "Saving…" : "Save snapshot now"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-text-lo">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={allowNormalize}
          onChange={(e) => setAllowNormalize(e.target.checked)}
        />
        <span>
          If a file isn’t a clean TEMPO export, reshape it with AI before
          preview (same brain as Import). Leave on for older or messy JSON.
        </span>
      </label>

      {preview ? (
        <div className="well mt-4 space-y-3 rounded-input p-3">
          <p className="text-sm text-text-hi">
            Ready to merge: {preview.summary}
            {preview.normalized ? " (reshaped by AI)" : ""}
          </p>
          <p className="text-xs text-text-lo">
            Exported {formatWhen(preview.exportedAt)}. Existing rows with the
            same ids are left alone — nothing is deleted.
          </p>
          {preview.notes.length ? (
            <ul className="list-inside list-disc text-xs text-text-lo">
              {preview.notes.slice(0, 4).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busyImport}
              onClick={() => void onConfirmImport()}
            >
              <RotateCcw className="mr-1.5 size-3.5" />
              {busyImport ? "Restoring…" : "Merge into catalog"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyImport}
              onClick={() => {
                setPreview(null);
                setPendingText(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-center gap-2">
          <History className="size-3.5 text-ice" />
          <p className="text-xs font-medium text-text-hi">Automatic snapshots</p>
        </div>
        <p className="mt-1 text-xs text-text-lo">
          TEMPO keeps recent metadata snapshots for you (about two weeks of
          dailies, plus a few weeklies). Restore merges missing rows back in.
        </p>
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
          {loadingSnaps ? (
            <p className="text-xs text-text-lo">Loading snapshots…</p>
          ) : snapshots.length === 0 ? (
            <p className="text-xs text-text-lo">
              No snapshots yet — they’ll appear after the nightly job runs, or
              tap Save snapshot now.
            </p>
          ) : (
            snapshots.map((snap) => (
              <div
                key={snap.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-input border border-line bg-bg-0/40 px-3 py-2",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs text-text-hi">
                    {formatWhen(snap.createdAt)}
                    <span className="ml-2 text-text-lo">
                      {snap.source === "manual" ? "manual" : "nightly"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-text-lo">
                    {snap.trackCount} tracks · {snap.projectCount} projects ·{" "}
                    {formatBytes(snap.bytes)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void downloadCatalogSnapshot(snap.id).catch((e) =>
                        toast(
                          e instanceof Error ? e.message : "Download failed.",
                        ),
                      )
                    }
                  >
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setRestoreSnapId(snap.id)}
                  >
                    Restore
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!restoreSnapId}
        onOpenChange={(o) => {
          if (!o) setRestoreSnapId(null);
        }}
        title="Restore this snapshot?"
        description="Missing rows from that point in time will be merged into your catalog. Existing rows with the same ids stay as they are. Audio files are not restored."
        confirmLabel="Merge snapshot"
        busy={busyRestoreSnap}
        onConfirm={() => void onConfirmRestoreSnap()}
      />
    </section>
  );
}
