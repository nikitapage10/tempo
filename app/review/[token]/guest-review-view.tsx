"use client";

import * as React from "react";
import WaveSurfer from "wavesurfer.js";
import { Download, Pause, Play } from "lucide-react";
import { FlareLine } from "@/components/flare-line";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration, formatShortDate } from "@/lib/format";
import { playbackCoordinator } from "@/lib/playback-coordinator";
import { cn } from "@/lib/utils";

type ReviewInfo = {
  track: { title: string; artist_alias: string | null; artwork_url: string | null };
  version: {
    id: string;
    version_no: number;
    label: string | null;
    changelog: string | null;
    duration: number | null;
    created_at: string;
  };
  allow_comments: boolean;
  allow_download: boolean;
  link_label: string | null;
  /** Owning artist's resolved palette; absent on older cached responses. */
  palette?: { ice: string; white: string; amber: string; gray: string };
};

const DEFAULT_PALETTE = {
  ice: "#7FB4FF",
  white: "#F2F0EB",
  amber: "#FFB56B",
  gray: "#8B8B96",
};

type GuestComment = {
  id: string;
  text: string;
  timestamp_sec: number | null;
  parent_id: string | null;
  resolved: boolean;
  created_at: string;
  author_label: string;
};

type Status = "loading" | "unavailable" | "ready";

const UNAVAILABLE_MESSAGE =
  "This review link isn’t available. It may have expired, been revoked, or the address is wrong.";

export function GuestReviewView({ token }: { token: string }) {
  const [status, setStatus] = React.useState<Status>("loading");
  const [info, setInfo] = React.useState<ReviewInfo | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/review/${token}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("unavailable");
        return (await res.json()) as ReviewInfo;
      })
      .then((data) => {
        if (!cancelled) {
          setInfo(data);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md space-y-3">
          <div className="h-6 w-1/2 animate-pulse rounded bg-bg-1" />
          <div className="h-24 animate-pulse rounded-card bg-bg-1" />
          <div className="h-40 animate-pulse rounded-card bg-bg-1" />
        </div>
      </div>
    );
  }

  if (status === "unavailable" || !info) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-display text-xl font-semibold text-text-hi">TEMPO</h1>
          <FlareLine className="mx-auto mt-3 max-w-[100px]" />
          <p className="mt-6 text-sm text-text-lo">{UNAVAILABLE_MESSAGE}</p>
        </div>
      </div>
    );
  }

  return <ReadyView token={token} info={info} />;
}

function ReadyView({ token, info }: { token: string; info: ReviewInfo }) {
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(info.version.duration ?? 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10 sm:px-6">
      <header className="mb-6 text-center">
        <p className="font-display text-sm font-semibold tracking-wide text-text-lo">TEMPO</p>
        <FlareLine className="mx-auto mt-2 max-w-[100px]" />
      </header>

      <section className="rounded-card border border-line bg-bg-1 p-5">
        <div className="flex items-start gap-4">
          {info.track.artwork_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={info.track.artwork_url}
              alt=""
              className="size-16 shrink-0 rounded-input object-cover"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-input bg-bg-2 font-mono text-lg text-text-lo">
              {info.track.title.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold text-text-hi">
              {info.track.title}
            </h1>
            {info.track.artist_alias ? (
              <p className="text-sm text-text-lo">{info.track.artist_alias}</p>
            ) : null}
            <p className="mt-1 font-mono text-[11px] text-amber">
              v{info.version.version_no}
              {info.version.label ? ` — ${info.version.label}` : ""}
            </p>
            {info.version.changelog ? (
              <p className="mt-1 text-xs text-text-lo">{info.version.changelog}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <GuestWaveform
            token={token}
            palette={info.palette ?? DEFAULT_PALETTE}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
          />
        </div>

        {info.allow_download ? (
          <div className="mt-3 flex justify-end">
            <DownloadButton token={token} />
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-card border border-line bg-bg-1 p-5">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Comments
        </h2>
        <GuestComments
          token={token}
          allowComments={info.allow_comments}
          currentTimeSec={currentTime}
          durationSec={duration}
        />
      </section>

      <footer className="mt-8 text-center text-[11px] text-text-lo">
        Shared via TEMPO — a private, time-limited review link.
      </footer>
    </div>
  );
}

function GuestWaveform({
  token,
  palette,
  onTimeUpdate,
  onDurationChange,
}: {
  token: string;
  palette: { ice: string; white: string; amber: string; gray: string };
  onTimeUpdate: (t: number) => void;
  onDurationChange: (d: number) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const wsRef = React.useRef<WaveSurfer | null>(null);
  const [ready, setReady] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const playbackId = `guest-review:${token}`;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: palette.gray,
      progressColor: palette.ice,
      cursorColor: palette.amber,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      height: 72,
      normalize: true,
    });
    wsRef.current = ws;

    const unregister = playbackCoordinator.register(playbackId, () => ws.pause());

    ws.on("ready", () => {
      if (cancelled) return;
      setReady(true);
      const d = ws.getDuration();
      setDuration(d);
      onDurationChange(d);
    });
    ws.on("play", () => {
      setPlaying(true);
      playbackCoordinator.notifyPlay(playbackId);
    });
    ws.on("pause", () => {
      setPlaying(false);
      playbackCoordinator.notifyStop(playbackId);
    });
    ws.on("timeupdate", (t) => {
      setCurrentTime(t);
      onTimeUpdate(t);
    });
    ws.on("finish", () => {
      setPlaying(false);
      playbackCoordinator.notifyStop(playbackId);
    });
    ws.on("error", () => {
      if (!cancelled) setError("Couldn’t load this bounce.");
    });

    fetch(`/api/review/${token}/audio`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("no url");
        const data = (await res.json()) as { url: string };
        if (cancelled) return;
        await ws.load(data.url);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn’t get a playback link.");
      });

    return () => {
      cancelled = true;
      unregister();
      ws.destroy();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per token
  }, [token]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-input border border-line bg-bg-2/80">
        <div ref={containerRef} className="w-full px-1 pt-2" />
        {!ready && !error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-2/60">
            <div className="mx-3 h-10 w-full animate-pulse rounded bg-bg-1/80" />
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-warn" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!ready}
          className={cn(
            "flex size-10 items-center justify-center rounded-full bg-ice text-bg-0 transition-opacity duration-hover",
            "hover:opacity-90 disabled:opacity-40"
          )}
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => void wsRef.current?.playPause()}
        >
          {playing ? (
            <Pause className="size-4" fill="currentColor" />
          ) : (
            <Play className="size-4 translate-x-px" fill="currentColor" />
          )}
        </button>
        <span className="font-mono text-xs text-text-lo">
          <span className="text-text-hi">{formatDuration(currentTime)}</span>
          {" / "}
          {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}

function DownloadButton({ token }: { token: string }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/review/${token}/download`, { cache: "no-store" });
      if (!res.ok) throw new Error("Download isn’t available.");
      const data = (await res.json()) as { url: string };
      const a = document.createElement("a");
      a.href = data.url;
      a.rel = "noopener";
      a.target = "_blank";
      a.click();
    } catch {
      setError("Couldn’t start the download — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void handleDownload()}>
        <Download className="size-3.5" />
        {busy ? "Preparing…" : "Download"}
      </Button>
      {error ? <p className="mt-1 text-[11px] text-warn">{error}</p> : null}
    </div>
  );
}

function GuestComments({
  token,
  allowComments,
  currentTimeSec,
  durationSec,
}: {
  token: string;
  allowComments: boolean;
  currentTimeSec: number;
  durationSec: number;
}) {
  const [comments, setComments] = React.useState<GuestComment[] | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  const load = React.useCallback(() => {
    fetch(`/api/review/${token}/comments`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as { comments: GuestComment[] };
        setComments(data.comments);
      })
      .catch(() => setLoadError(true));
  }, [token]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      {allowComments ? (
        <GuestCommentComposer
          token={token}
          currentTimeSec={currentTimeSec}
          durationSec={durationSec}
          onPosted={load}
        />
      ) : (
        <p className="text-xs text-text-lo">
          Comments are off for this link — you can still listen.
        </p>
      )}

      {comments == null ? (
        loadError ? (
          <p className="text-sm text-text-lo">Couldn’t load comments right now.</p>
        ) : (
          <div className="h-12 animate-pulse rounded-card bg-bg-2" />
        )
      ) : comments.length === 0 ? (
        <p className="py-2 text-center text-sm text-text-lo">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments
            .filter((c) => !c.parent_id)
            .map((c) => (
              <li key={c.id} className="rounded-card border border-line bg-bg-2/40 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-text-lo">
                  {c.timestamp_sec != null ? (
                    <span className="rounded-chip bg-ice/15 px-1.5 py-0.5 text-ice">
                      {formatDuration(c.timestamp_sec)}
                    </span>
                  ) : null}
                  <span className="text-violet">{c.author_label}</span>
                  <span>{formatShortDate(c.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-text-hi">{c.text}</p>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function GuestCommentComposer({
  token,
  currentTimeSec,
  durationSec,
  onPosted,
}: {
  token: string;
  currentTimeSec: number;
  durationSec: number;
  onPosted: () => void;
}) {
  const [name, setName] = React.useState("");
  const [text, setText] = React.useState("");
  const [pinned, setPinned] = React.useState(true);
  const [website, setWebsite] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/review/${token}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          guest_name: name.trim(),
          text: trimmed,
          timestamp_sec: pinned ? currentTimeSec : null,
          website,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Couldn’t post that comment — try again.");
        return;
      }
      setText("");
      onPosted();
    } catch {
      setError("Couldn’t post that comment — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-card border border-line bg-bg-2/40 p-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name (optional)"
        maxLength={60}
        className="h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi placeholder:text-text-lo/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      />
      {/* Honeypot — hidden from real users, left for bots to fill. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What do you think?"
        rows={2}
        maxLength={2000}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {durationSec > 0 ? (
          <label className="flex items-center gap-2 text-xs text-text-lo">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Pin to <span className="font-mono text-amber">{formatDuration(currentTimeSec)}</span>
          </label>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm" disabled={busy || !text.trim()}>
          {busy ? "Posting…" : "Post comment"}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-warn" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
