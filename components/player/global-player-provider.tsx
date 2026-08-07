"use client";

/**
 * App-wide "now playing" mini-player. A single <audio> element lives here,
 * registered with playbackCoordinator like every other player, so opening a
 * waveform elsewhere pauses this one and vice versa. Its queue follows every
 * playable track in the active space; Next/Prev walks that queue and wraps.
 */

import * as React from "react";
import { useActiveSpace } from "@/components/active-space-provider";
import { useTracks } from "@/hooks/use-tracks";
import { useVersionsForTracks } from "@/hooks/use-versions";
import { playbackCoordinator } from "@/lib/playback-coordinator";
import { getSignedUrl } from "@/lib/storage";
import { useCurrentUser } from "@/hooks/use-current-user";

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
  /** Plays `track`. The active-space catalog is preferred; `queue` is a fallback for other contexts. */
  play: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
};

const GlobalPlayerContext = React.createContext<GlobalPlayerContextValue | null>(null);
const PLAYBACK_ID = "global-player";
/**
 * Per-user, deliberately.
 *
 * This was a single global key, which meant signing out and into a different
 * account restored the previous account's queue — their track titles and
 * artwork, sitting in the player bar of someone who should never see them.
 * Scoping by user id keeps each account's playback to itself; the sweep in
 * `forgetOtherUsers` clears anything left behind by the old shared key or by a
 * previous occupant of the browser.
 */
const PERSIST_PREFIX = "tempo:global-player:v1";

function persistKey(userId: string): string {
  return `${PERSIST_PREFIX}:${userId}`;
}

/** Drop the legacy shared key and any other account's saved queue. */
function forgetOtherUsers(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    const keep = persistKey(userId);
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === PERSIST_PREFIX || (key.startsWith(`${PERSIST_PREFIX}:`) && key !== keep)) {
        doomed.push(key);
      }
    }
    doomed.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage unavailable — nothing to clean */
  }
}

type PersistedPlayerState = {
  queue: PlayerTrack[];
  index: number;
  time: number;
};

function readPersistedState(userId: string | null): PersistedPlayerState | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(persistKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPlayerState;
    if (!parsed || !Array.isArray(parsed.queue) || parsed.queue.length === 0) return null;
    if (parsed.index < 0 || parsed.index >= parsed.queue.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedState(userId: string | null, state: PersistedPlayerState): void {
  // No user, no write: an unattributed queue is exactly what leaked before.
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(persistKey(userId), JSON.stringify(state));
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

  const currentUser = useCurrentUser();
  const userId = currentUser?.id ?? null;
  const userIdRef = React.useRef<string | null>(null);
  const { activeSpaceId } = useActiveSpace();
  const spaceTracksQuery = useTracks(activeSpaceId);
  const spaceTrackIds = React.useMemo(
    () => (spaceTracksQuery.data ?? []).map((track) => track.id),
    [spaceTracksQuery.data]
  );
  const spaceVersionsQuery = useVersionsForTracks(spaceTrackIds);

  /**
   * The canonical queue belongs to the active space, not to whichever filters
   * happened to be visible the last time Play was pressed on Tracks.
   */
  const catalogQueue = React.useMemo<PlayerTrack[]>(() => {
    const versionsByTrack = spaceVersionsQuery.data;
    if (!versionsByTrack) return [];
    const playable: PlayerTrack[] = [];
    for (const track of spaceTracksQuery.data ?? []) {
      const versions = versionsByTrack.get(track.id);
      if (!versions?.length) continue;
      const version = versions.find((item) => item.is_current) ?? versions[0];
      playable.push({
        id: track.id,
        title: track.title,
        artist: track.artist_alias,
        artworkUrl: track.artwork_url,
        fileUrl: version.file_url,
      });
    }
    return playable;
  }, [spaceTracksQuery.data, spaceVersionsQuery.data]);
  const catalogQueueRef = React.useRef<PlayerTrack[]>([]);
  catalogQueueRef.current = catalogQueue;

  React.useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // The account-binding effect lives below loadIndex, which it depends on.

  const persist = React.useCallback(() => {
    if (queueRef.current.length === 0 || indexRef.current < 0) return;
    writePersistedState(userIdRef.current, {
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
      writePersistedState(userIdRef.current, { queue: q, index: nextIndex, time: 0 });
    },
    [loadIndex]
  );

  /**
   * Bind playback to the signed-in account.
   *
   * Runs whenever the user resolves or changes. Switching account tears the
   * player down completely before touching storage — the previous occupant's
   * queue must not survive the switch even in memory, and their signed audio
   * URL must stop being loaded.
   */
  React.useEffect(() => {
    // `undefined` means auth hasn't resolved yet; don't act on a guess.
    if (currentUser === undefined) return;

    const previous = userIdRef.current;
    if (previous === userId) return;
    userIdRef.current = userId;

    const audio = audioRef.current;
    if (previous !== null) {
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      queueRef.current = [];
      indexRef.current = -1;
      resumeTimeRef.current = null;
      setQueue([]);
      setCurrentIndex(-1);
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }

    if (!userId) return;
    forgetOtherUsers(userId);

    // Resume this account's own queue — loaded, not autoplayed, since browsers
    // block unprompted autoplay anyway.
    const persisted = readPersistedState(userId);
    if (!persisted) return;
    queueRef.current = persisted.queue;
    setQueue(persisted.queue);
    resumeTimeRef.current = persisted.time;
    loadIndex(persisted.index, false);
  }, [currentUser, userId, loadIndex]);

  /**
   * Replace an old persisted or filtered queue without interrupting playback.
   * The current track keeps its position; only its neighbors are refreshed.
   */
  React.useEffect(() => {
    if (!spaceTracksQuery.isSuccess || !spaceVersionsQuery.isSuccess) return;
    if (catalogQueue.length === 0 || currentIndex < 0) return;
    const currentTrack = queueRef.current[indexRef.current];
    if (!currentTrack) return;
    const nextIndex = catalogQueue.findIndex((track) => track.id === currentTrack.id);
    if (nextIndex < 0) return;

    queueRef.current = catalogQueue;
    indexRef.current = nextIndex;
    setQueue(catalogQueue);
    setCurrentIndex(nextIndex);
    writePersistedState(userIdRef.current, {
      queue: catalogQueue,
      index: nextIndex,
      time: currentTimeRef.current,
    });
  }, [
    catalogQueue,
    currentIndex,
    spaceTracksQuery.isSuccess,
    spaceVersionsQuery.isSuccess,
  ]);

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

    // Resuming happens in the effect below instead: it has to wait until the
    // signed-in user is known, because the saved queue is per-account.

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
      const currentCatalog = catalogQueueRef.current;
      const q = currentCatalog.some((item) => item.id === track.id)
        ? currentCatalog
        : newQueue && newQueue.length > 0
          ? newQueue
          : [track];
      const idx = q.findIndex((t) => t.id === track.id);
      queueRef.current = q;
      setQueue(q);
      loadIndex(idx >= 0 ? idx : 0, true);
      writePersistedState(userIdRef.current, { queue: q, index: idx >= 0 ? idx : 0, time: 0 });
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
