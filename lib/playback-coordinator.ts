/**
 * Tiny pub/sub so only one audio player is ever audible at a time — the
 * version player, guest review player, and reference-track players all
 * register here and get paused automatically when another one starts.
 *
 * Usage:
 *   useEffect(() => playbackCoordinator.register(id, () => wavesurfer.pause()), []);
 *   // on play:
 *   playbackCoordinator.notifyPlay(id);
 *   // on pause/end:
 *   playbackCoordinator.notifyStop(id);
 */

export type PauseHandler = () => void;

class PlaybackCoordinator {
  private players = new Map<string, PauseHandler>();
  private activeId: string | null = null;

  /** Registers a player's pause callback. Returns an unregister function — call it on unmount. */
  register(id: string, pause: PauseHandler): () => void {
    this.players.set(id, pause);
    return () => {
      if (this.players.get(id) === pause) {
        this.players.delete(id);
      }
      if (this.activeId === id) {
        this.activeId = null;
      }
    };
  }

  /** Call when a player starts playing — pauses every other registered player. */
  notifyPlay(id: string): void {
    if (this.activeId === id) return;
    this.activeId = id;
    this.players.forEach((pause, otherId) => {
      if (otherId === id) return;
      try {
        pause();
      } catch {
        /* a stale/unmounted player's callback shouldn't block the others */
      }
    });
  }

  /** Call when a player pauses/ends on its own, so a stopped player doesn't block itself later. */
  notifyStop(id: string): void {
    if (this.activeId === id) {
      this.activeId = null;
    }
  }

  /** The id of the currently-playing registered player, if any. */
  getActiveId(): string | null {
    return this.activeId;
  }
}

/** Singleton — one coordinator per browser tab, matching the DOM audio it manages. */
export const playbackCoordinator = new PlaybackCoordinator();
