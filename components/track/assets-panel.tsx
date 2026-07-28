"use client";

import * as React from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/ui/dropzone";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useAssetMutations, useAssets } from "@/hooks/use-assets";
import { ASSET_KINDS } from "@/lib/constants";
import { formatFileSize, formatShortDate } from "@/lib/format";
import { getSignedUrl } from "@/lib/storage";
import type { Asset, AssetKind } from "@/lib/types";
import { cn } from "@/lib/utils";

type AssetsPanelProps = {
  trackId: string;
};

const KIND_ORDER: AssetKind[] = [
  "stem",
  "midi",
  "artwork",
  "lyrics",
  "reference",
  "other",
];

export function AssetsPanel({ trackId }: AssetsPanelProps) {
  const { data: assets = [], isLoading } = useAssets(trackId);
  const { upload, remove } = useAssetMutations(trackId);
  const { toast } = useToast();

  const [kind, setKind] = React.useState<AssetKind>("stem");
  const [progress, setProgress] = React.useState<number | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  const grouped = React.useMemo(() => {
    const map = new Map<AssetKind, Asset[]>();
    for (const k of KIND_ORDER) map.set(k, []);
    for (const a of assets) {
      const list = map.get(a.kind) ?? [];
      list.push(a);
      map.set(a.kind, list);
    }
    return map;
  }, [assets]);

  async function handleFiles(files: FileList | File[] | null) {
    const file = files?.[0];
    if (!file) return;
    setProgress(0);
    try {
      await upload.mutateAsync({
        file,
        kind,
        onProgress: setProgress,
      });
      setProgress(null);
      toast(
        kind === "artwork"
          ? "Artwork uploaded — track thumbnail updated"
          : "Asset uploaded",
        "ok"
      );
    } catch (err) {
      setProgress(null);
      toast(
        err instanceof Error
          ? err.message
          : "Upload failed — try again, or pick a different file."
      );
    }
  }

  async function handleDownload(a: Asset) {
    try {
      const url = await getSignedUrl(a.file_url);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.name;
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
    } catch (err) {
      toast(
        err instanceof Error
          ? err.message
          : "Download failed — sign in again, then retry."
      );
    }
  }

  return (
    <section className="rounded-card border border-line bg-bg-1 p-4">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
        Stems & assets
      </h2>

      <Dropzone
        className="p-3"
        accept={
          kind === "artwork"
            ? "image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
            : undefined
        }
        disabled={progress != null}
        onFiles={(files) => void handleFiles(files)}
      >
        {({ open }) => (
        <>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[8rem] flex-1">
            <Label htmlFor={`asset-kind-${trackId}`}>Kind</Label>
            <select
              id={`asset-kind-${trackId}`}
              className="mt-1 h-8 w-full rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              value={kind}
              onChange={(e) => setKind(e.target.value as AssetKind)}
              disabled={progress != null}
            >
              {ASSET_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={progress != null}
            onClick={open}
          >
            {progress != null ? `${progress}%` : "Upload"}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-text-lo">
          Drop a file here. Artwork uploads set the track cover.
        </p>
        </>
        )}
      </Dropzone>

      <div className="mt-4 space-y-4">
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-card bg-bg-2" />
        ) : assets.length === 0 ? (
          <p className="py-2 text-center text-sm text-text-lo">
            No stems or assets yet.
          </p>
        ) : (
          KIND_ORDER.map((k) => {
            const list = grouped.get(k) ?? [];
            if (!list.length) return null;
            const label =
              ASSET_KINDS.find((x) => x.value === k)?.label ?? k;
            return (
              <div key={k}>
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-lo">
                  {label}
                </p>
                <ul className="space-y-1.5">
                  {list.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start justify-between gap-2 rounded-input border border-line bg-bg-2/40 px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs text-text-hi">{a.name}</p>
                        <p className="font-mono text-[10px] text-text-lo">
                          {formatShortDate(a.created_at)} ·{" "}
                          {formatFileSize(a.file_size)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          aria-label="Download"
                          className="rounded-input p-1.5 text-text-lo hover:text-ice"
                          onClick={() => void handleDownload(a)}
                        >
                          <Download className="size-3.5" />
                        </button>
                        {confirmId === a.id ? (
                          <span className="flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              className="text-warn hover:underline"
                              onClick={async () => {
                                try {
                                  await remove.mutateAsync(a);
                                  setConfirmId(null);
                                } catch (err) {
                                  toast(
                                    err instanceof Error
                                      ? err.message
                                      : "Couldn’t delete asset."
                                  );
                                }
                              }}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              className="text-text-lo"
                              onClick={() => setConfirmId(null)}
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label="Delete"
                            className="rounded-input p-1.5 text-text-lo hover:text-warn"
                            onClick={() => setConfirmId(a.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
