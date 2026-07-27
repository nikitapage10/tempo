"use client";

import * as React from "react";
import { Download, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useVersionMutations, useVersions } from "@/hooks/use-versions";
import { AUDIO_ACCEPT } from "@/lib/constants";
import { formatFileSize, formatShortDate } from "@/lib/format";
import { getSignedUrl } from "@/lib/storage";
import type { Version } from "@/lib/types";
import { cn } from "@/lib/utils";

type VersionsPanelProps = {
  trackId: string;
  onPlay: (versionId: string) => void;
  playingId: string | null;
};

export function VersionsPanel({
  trackId,
  onPlay,
  playingId,
}: VersionsPanelProps) {
  const { data: versions = [], isLoading } = useVersions(trackId);
  const { upload, setCurrent, remove } = useVersionMutations(trackId);
  const { toast } = useToast();

  const [changelog, setChangelog] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [phase, setPhase] = React.useState<"converting" | "uploading" | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[] | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setProgress(0);
    setPhase(null);
    try {
      const version = await upload.mutateAsync({
        file,
        changelog,
        onProgress: setProgress,
        onPhase: setPhase,
      });
      setChangelog("");
      setProgress(null);
      setPhase(null);
      onPlay(version.id);
      toast(`Uploaded v${version.version_no}`, "ok");
    } catch (err) {
      setProgress(null);
      setPhase(null);
      const msg =
        err instanceof Error
          ? err.message
          : "Upload failed — try again, or pick a different file.";
      setError(msg);
      toast(msg);
    }
  }

  async function handleDownload(v: Version) {
    try {
      const url = await getSignedUrl(v.file_url);
      const a = document.createElement("a");
      a.href = url;
      a.download = v.label || `v${v.version_no}`;
      a.rel = "noopener";
      a.target = "_blank";
      a.click();
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
        Versions
      </h2>

      <div
        className={cn(
          "rounded-card border border-dashed p-4 transition-colors duration-hover",
          dragging
            ? "border-ice bg-ice/5"
            : "border-line bg-bg-2/40 hover:border-ice/50"
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-sm text-text-hi">Upload a bounce</p>
        <p className="mt-1 text-xs text-text-lo">
          mp3 / wav / aiff / m4a · up to 200 MB · keeps the latest 2 versions.
          Wav and aiff are converted to mp3 in your browser before upload.
        </p>
        <div className="mt-3 space-y-2">
          <Label htmlFor={`changelog-${trackId}`}>What changed?</Label>
          <Input
            id={`changelog-${trackId}`}
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="Reworked drop, louder vocal…"
            disabled={progress != null}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={progress != null}
            onClick={() => inputRef.current?.click()}
          >
            {progress != null
              ? phase === "converting"
                ? `Converting ${progress}%`
                : `Uploading ${progress}%`
              : "Upload new version"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={AUDIO_ACCEPT}
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {progress != null ? (
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-bg-0">
              <div
                className="h-full rounded-full bg-gradient-to-r from-ice to-amber transition-all duration-hover"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
        </div>
        {error ? (
          <p className="mt-2 text-sm text-warn" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2">
        {isLoading ? (
          <li className="h-16 animate-pulse rounded-card bg-bg-2" />
        ) : versions.length === 0 ? (
          <li className="py-4 text-center text-sm text-text-lo">
            No versions yet. Drop a bounce above.
          </li>
        ) : (
          versions.map((v) => (
            <li
              key={v.id}
              className={cn(
                "rounded-card border border-line bg-bg-2/50 px-3 py-2.5",
                playingId === v.id && "ring-1 ring-ice/40"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "font-mono text-sm",
                        v.is_current ? "text-amber" : "text-text-hi"
                      )}
                    >
                      v{v.version_no}
                    </span>
                    {v.label ? (
                      <span className="truncate text-sm text-text-hi">
                        {v.label}
                      </span>
                    ) : null}
                    {v.is_current ? (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-amber">
                        current
                      </span>
                    ) : null}
                  </div>
                  {v.changelog ? (
                    <p className="mt-0.5 text-xs text-text-lo">{v.changelog}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-[11px] text-text-lo">
                    {formatShortDate(v.created_at)} · {formatFileSize(v.file_size)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <IconBtn
                    label="Play"
                    onClick={() => onPlay(v.id)}
                  >
                    <Play className="size-3.5" />
                  </IconBtn>
                  {!v.is_current ? (
                    <button
                      type="button"
                      className="rounded-input px-2 py-1 text-[11px] text-ice hover:bg-ice/10"
                      onClick={async () => {
                        try {
                          await setCurrent.mutateAsync(v.id);
                        } catch (err) {
                          toast(
                            err instanceof Error
                              ? err.message
                              : "Couldn’t mark as current."
                          );
                        }
                      }}
                    >
                      Set current
                    </button>
                  ) : null}
                  <IconBtn label="Download" onClick={() => void handleDownload(v)}>
                    <Download className="size-3.5" />
                  </IconBtn>
                  {confirmId === v.id ? (
                    <span className="flex items-center gap-1 text-[11px]">
                      <span className="text-warn">Delete forever?</span>
                      <button
                        type="button"
                        className="text-warn hover:underline"
                        onClick={async () => {
                          try {
                            await remove.mutateAsync(v);
                            setConfirmId(null);
                          } catch (err) {
                            toast(
                              err instanceof Error
                                ? err.message
                                : "Couldn’t delete version."
                            );
                          }
                        }}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        className="text-text-lo hover:text-text-hi"
                        onClick={() => setConfirmId(null)}
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <IconBtn
                      label="Delete"
                      onClick={() => setConfirmId(v.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </IconBtn>
                  )}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="rounded-input p-1.5 text-text-lo transition-colors duration-hover hover:bg-bg-1 hover:text-ice"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
