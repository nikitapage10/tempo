"use client";

/**
 * App-wide "now playing" mini-player. A single <audio> element lives here,
 * registered with playbackCoordinator like every other player, so opening a
 * waveform elsewhere pauses this one and vice versa. Track lists hand it a
 * queue; Next/Prev just walks that queue (wrapping at the ends).
 */

import * as React from "react";
import { playbackCoordinator } from "@/lib/playback-coordinator";
import { getSignedUrl } from "@/lib/storage";

export type PlayerTrack = {
  id: string;
  title: string;
  artist: string | null;
  artworkUrl: string | null;
  /** Storage path (or absolute URL) for the audio to play. */
  fileUrl: string;
};

type GlobalPlayerContextValue = {
  queue: PlayerTrack[];
  current: PlayerTrack | null;
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  /** Plays `track`. If `queue` is given, Next/Prev walk that list; otherwise the track plays alone. */
  play: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
};

const GlobalPlayerContext = React.createContext<GlobalPlayerContextValue | null>(null);
const PLAYBACK_ID = "global-player";
const PERSIST_KEY = "tempo:global-player:v1";

type PersistedPlayerState = {
  queue: PlayerTrack[];
  index: number;
  time: number;
};

function readPersistedState(): PersistedPlayerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPlayerState;
    if (!parsed || !Array.isArray(parsed.queue) || parsed.queue.length === 0) return null;
    if (parsed.index < 0 || parsed.index >= parsed.queue.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedState(state: PersistedPlayerState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable — resuming across sessions just won't work */
  }
}

export function GlobalPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const queueRef = React.useRef<PlayerTrack[]>([]);
  const indexRef = React.useRef(-1);
  const currentTimeRef = React.useRef(0);
  const resumeTimeRef = React.useRef<number | null>(null);

  const [queue, setQueue] = React.useState<PlayerTrack[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(-1);
  const [playing, setPlaying] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  React.useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const persist = React.useCallback(() => {
    if (queueRef.current.length === 0 || indexRef.current < 0) return;
    writePersistedState({
      queue: queueRef.current,
      index: indexRef.current,
      time: currentTimeRef.current,
    });
  }, []);

  const loadIndex = React.useCallback((index: number, autoplay: boolean) => {
    const track = queueRef.current[index];
    const audio = audioRef.current;
    if (!track || !audio) return;

    indexRef.current = index;
    setCurrentIndex(index);
    setCurrentTime(0);
    setDuration(0);
    setLoading(true);

    getSignedUrl(track.fileUrl)
      .then((url) => {
        if (audioRef.current !== audio) return;
        audio.src = url;
        setLoading(false);
        if (autoplay) {
          void audio.play().catch(() => {
            /* autoplay can be blocked; user can hit play again */
          });
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const goRelative = React.useCallback(
    (delta: number) => {
      const q = queueRef.current;
      if (q.length === 0) return;
      const nextIndex = (indexRef.current + delta + q.length) % q.length;
      loadIndex(nextIndex, true);
      writePersistedState({ queue: q, index: nextIndex, time: 0 });
    },
    [loadIndex]
  );

  React.useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const unregister = playbackCoordinator.register(PLAYBACK_ID, () => audio.pause());

    const onPlay = () => {
      setPlaying(true);
      playbackCoordinator.notifyPlay(PLAYBACK_ID);
    };
    const onPause = () => {
      setPlaying(false);
      playbackCoordinator.notifyStop(PLAYBACK_ID);
      persist();
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      if (resumeTimeRef.current != null) {
        const clamped = Math.min(resumeTimeRef.current, audio.duration || resumeTimeRef.current);
        audio.currentTime = clamped;
        setCurrentTime(clamped);
        resumeTimeRef.current = null;
      }
    };
    const onEnded = () => {
      setPlaying(false);
      playbackCoordinator.notifyStop(PLAYBACK_ID);
      goRelative(1);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    window.addEventListener("beforeunload", persist);

    // Resume whatever was playing last session — loaded but not autoplayed,
    // since browsers block unprompted autoplay anyway.
    const persisted = readPersistedState();
    if (persisted) {
      queueRef.current = persisted.queue;
      setQueue(persisted.queue);
      resumeTimeRef.current = persisted.time;
      loadIndex(persisted.index, false);
    }

    return () => {
      unregister();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      window.removeEventListener("beforeunload", persist);
      audio.pause();
      audioRef.current = null;
    };
  }, [goRelative, loadIndex, persist]);

  const play = React.useCallback(
    (track: PlayerTrack, newQueue?: PlayerTrack[]) => {
      const q = newQueue && newQueue.length > 0 ? newQueue : [track];
      const idx = q.findIndex((t) => t.id === track.id);
      queueRef.current = q;
      setQueue(q);
      loadIndex(idx >= 0 ? idx : 0, true);
      writePersistedState({ queue: q, index: idx >= 0 ? idx : 0, time: 0 });
    },
    [loadIndex]
  );

  const toggle = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  }, []);

  const next = React.useCallback(() => goRelative(1), [goRelative]);
  const prev = React.useCallback(() => goRelative(-1), [goRelative]);

  const current = queue[currentIndex] ?? null;

  const value = React.useMemo<GlobalPlayerContextValue>(
    () => ({
      queue,
      current,
      playing,
      loading,
      currentTime,
      duration,
      play,
      toggle,
      next,
      prev,
    }),
    [queue, current, playing, loading, currentTime, duration, play, toggle, next, prev]
  );

  return (
    <GlobalPlayerContext.Provider value={value}>{children}</GlobalPlayerContext.Provider>
  );
}

export function useGlobalPlayer(): GlobalPlayerContextValue {
  const ctx = React.useContext(GlobalPlayerContext);
  if (!ctx) throw new Error("useGlobalPlayer must be used within GlobalPlayerProvider");
  return ctx;
}
