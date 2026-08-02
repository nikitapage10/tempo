import {
  ORIGIN_MEDIA,
  originAsset,
  type OriginMediaKey,
} from "@/lib/origin/media";

/**
 * ORIGIN media readiness and predictive preloading.
 *
 * One pool per mounted flow. Assets are warmed by detached, muted video
 * elements pointed at the same URLs the visible elements will use, so the
 * browser's ordinary HTTP cache does the sharing — there is exactly one
 * fetching mechanism, and nothing is held in JavaScript memory.
 *
 * `preload="auto"` is a hint and `canplaythrough` is a browser estimate that
 * lies on throttled connections, so readiness is derived from `readyState` plus
 * real buffered ranges. Continuous values (buffered seconds) stay on the entry
 * and are only surfaced to React when the readiness *category* changes.
 */

export type MediaReadiness =
  | "idle"
  | "loading-metadata"
  | "buffering"
  | "playable"
  | "ready"
  | "failed";

export type LoadPriority = "high" | "low";

/** Seconds of contiguous head buffer that make a transition or loop safe to start. */
const READY_SECONDS = 2.5;
/** A scrub asset is only ready when nearly all of it is buffered — see §9. */
const SCRUB_READY_FRACTION = 0.95;

const MAX_CONCURRENT_HIGH = 2;
const MAX_CONCURRENT_LOW = 1;

type Connection = { saveData?: boolean; effectiveType?: string };

function connection(): Connection | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as unknown as { connection?: Connection }).connection ?? null;
}

export type NetworkProfile = "full" | "lite" | "save-data";

/**
 * Which experience this connection should get. `lite` and `save-data` both fall
 * back to the static poster flow; they differ only in whether we speculatively
 * warm anything at all.
 */
export function networkProfile(): NetworkProfile {
  const c = connection();
  if (!c) return "full";
  if (c.saveData) return "save-data";
  if (c.effectiveType === "slow-2g" || c.effectiveType === "2g") return "lite";
  return "full";
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Contiguous buffered seconds from `from`, walking adjacent ranges. */
export function bufferedAhead(video: HTMLVideoElement, from = 0): number {
  const ranges = video.buffered;
  let end = from;
  let moved = true;
  while (moved) {
    moved = false;
    for (let i = 0; i < ranges.length; i += 1) {
      // The epsilon covers the small gaps browsers leave between ranges.
      if (ranges.start(i) <= end + 0.25 && ranges.end(i) > end) {
        end = ranges.end(i);
        moved = true;
      }
    }
  }
  return Math.max(0, end - from);
}

type Listener = () => void;

/**
 * Where warm-up elements live while they buffer.
 *
 * WebKit will not buffer a `<video>` that is not in the document — a detached
 * element created with `createElement` gets metadata and then stops, so on
 * Safari every readiness gate stayed shut and the flow sat waiting on assets it
 * believed were still downloading. The element has to be in the tree and
 * rendered (not `display: none`, which WebKit throttles the same way), so it is
 * parked at 1x1 and fully transparent instead.
 */
let warmHost: HTMLElement | null = null;

function warmContainer(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  if (warmHost?.isConnected) return warmHost;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.dataset.originWarm = "";
  host.style.cssText =
    "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1";
  document.body.appendChild(host);
  warmHost = host;
  return host;
}

class Entry {
  readonly key: OriginMediaKey;
  readiness: MediaReadiness = "idle";
  /** 0–1 toward the readiness target. Read via refs; not React state. */
  progress = 0;
  priority: LoadPriority = "low";
  started = false;

  private el: HTMLVideoElement | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private detachListeners: (() => void) | null = null;
  private readonly onCategoryChange: Listener;

  constructor(key: OriginMediaKey, onCategoryChange: Listener) {
    this.key = key;
    this.onCategoryChange = onCategoryChange;
  }

  private target(): number {
    const asset = originAsset(this.key);
    if (asset.mode === "scrub") return asset.duration * SCRUB_READY_FRACTION;
    return Math.min(READY_SECONDS, Math.max(0.5, asset.duration - 0.05));
  }

  start() {
    if (this.started || typeof document === "undefined") return;
    this.started = true;

    const asset = originAsset(this.key);
    const el = document.createElement("video");
    this.el = el;
    el.preload = "auto";
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    el.setAttribute("playsinline", "");

    const setState = (next: MediaReadiness, progress: number) => {
      this.progress = progress;
      if (this.readiness === next) return;
      this.readiness = next;
      this.onCategoryChange();
    };

    const evaluate = () => {
      // Both are terminal, and "ready" has already given its element back.
      if (this.readiness === "failed" || this.readiness === "ready") return;
      const ahead = bufferedAhead(el, 0);
      const target = this.target();
      const ratio = target > 0 ? Math.min(1, ahead / target) : 0;

      if (ahead >= target && el.readyState >= 3 /* HAVE_FUTURE_DATA */) {
        setState("ready", 1);
        this.stopPolling();
        // The bytes are in the HTTP cache now, which is the only thing this
        // element was ever for. Releasing it matters on Safari, which allows
        // far fewer simultaneous media elements than Chrome — holding all ten
        // warm assets open alongside the stage's own two starved the clips
        // that were actually on screen.
        this.release();
      } else if (el.readyState >= 2 /* HAVE_CURRENT_DATA */) {
        setState("playable", ratio);
      } else if (el.readyState >= 1 /* HAVE_METADATA */) {
        setState("buffering", ratio);
      }
    };

    const onError = () => {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[origin] media failed: ${asset.id} (${asset.src})`);
      }
      setState("failed", this.progress);
      this.stopPolling();
    };

    el.addEventListener("loadedmetadata", evaluate);
    el.addEventListener("loadeddata", evaluate);
    el.addEventListener("canplay", evaluate);
    el.addEventListener("progress", evaluate);
    el.addEventListener("suspend", evaluate);
    el.addEventListener("error", onError);

    // Detached before the element is torn down. Dropping the source and
    // reloading fires `error`, which would otherwise flip a finished asset to
    // "failed" and shut the gate it had just opened.
    this.detachListeners = () => {
      el.removeEventListener("loadedmetadata", evaluate);
      el.removeEventListener("loadeddata", evaluate);
      el.removeEventListener("canplay", evaluate);
      el.removeEventListener("progress", evaluate);
      el.removeEventListener("suspend", evaluate);
      el.removeEventListener("error", onError);
    };

    // `progress` goes quiet once a browser decides it has buffered enough, and
    // is skipped entirely on cache hits, so readiness cannot rely on it alone.
    this.poll = setInterval(evaluate, 250);

    setState("loading-metadata", 0);
    el.src = asset.src;
    warmContainer()?.appendChild(el);
    el.load();
  }

  private stopPolling() {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }

  /** Give the decoder slot back. Readiness state is kept. */
  private release() {
    const el = this.el;
    if (!el) return;
    this.el = null;
    this.detachListeners?.();
    this.detachListeners = null;
    el.removeAttribute("src");
    el.load();
    el.remove();
  }

  destroy() {
    this.stopPolling();
    this.release();
  }
}

/**
 * The pool. Create one per mounted flow and call `destroy()` on route exit —
 * that cancels every speculative load.
 */
export class OriginMediaPool {
  private readonly entries = new Map<OriginMediaKey, Entry>();
  private readonly order: OriginMediaKey[] = [];
  private readonly listeners = new Set<Listener>();
  private visible = true;
  private detach: (() => void) | null = null;
  private readonly profile: NetworkProfile;

  constructor(profile: NetworkProfile = networkProfile()) {
    this.profile = profile;
    if (typeof document !== "undefined") {
      const onVis = () => {
        this.visible = document.visibilityState === "visible";
        if (this.visible) this.pump();
      };
      document.addEventListener("visibilitychange", onVis);
      this.visible = document.visibilityState === "visible";
      this.detach = () => document.removeEventListener("visibilitychange", onVis);
    }
  }

  /** Fires only when some asset's readiness category changes. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit = () => {
    this.listeners.forEach((fn) => fn());
  };

  private entry(key: OriginMediaKey): Entry {
    let e = this.entries.get(key);
    if (!e) {
      e = new Entry(key, this.emit);
      this.entries.set(key, e);
      this.order.push(key);
    }
    return e;
  }

  /** Queue an asset. Calling again with "high" promotes without restarting. */
  request(key: OriginMediaKey, priority: LoadPriority = "low") {
    const e = this.entry(key);
    if (priority === "high") e.priority = "high";
    this.pump();
  }

  /** Start now, ignoring queue limits — for the asset about to be seen. */
  demand(key: OriginMediaKey) {
    const e = this.entry(key);
    e.priority = "high";
    e.start();
  }

  readiness(key: OriginMediaKey): MediaReadiness {
    return this.entries.get(key)?.readiness ?? "idle";
  }

  progress(key: OriginMediaKey): number {
    return this.entries.get(key)?.progress ?? 0;
  }

  isReady(key: OriginMediaKey): boolean {
    return this.readiness(key) === "ready";
  }

  isPlayable(key: OriginMediaKey): boolean {
    const r = this.readiness(key);
    return r === "playable" || r === "ready";
  }

  failed(key: OriginMediaKey): boolean {
    return this.readiness(key) === "failed";
  }

  /** Ready, or failed — a failed asset must not block the flow forever. */
  settled(key: OriginMediaKey): boolean {
    const r = this.readiness(key);
    return r === "ready" || r === "failed";
  }

  private pump() {
    if (!this.visible) return;
    // Save Data never speculatively downloads; the static flow is used instead.
    if (this.profile === "save-data") return;

    let high = 0;
    let low = 0;
    this.order.forEach((key) => {
      const e = this.entries.get(key);
      if (!e?.started || e.readiness === "ready" || e.readiness === "failed") return;
      if (e.priority === "high") high += 1;
      else low += 1;
    });

    for (const key of this.order) {
      const e = this.entries.get(key);
      if (!e || e.started) continue;
      if (e.priority === "high") {
        if (high >= MAX_CONCURRENT_HIGH) continue;
        high += 1;
      } else {
        // Background work never competes with the asset the artist is waiting
        // on, and never runs at all on a constrained connection.
        if (high > 0 || low >= MAX_CONCURRENT_LOW || this.profile !== "full") continue;
        low += 1;
      }
      e.start();
    }
  }

  destroy() {
    this.detach?.();
    this.detach = null;
    this.entries.forEach((e) => e.destroy());
    this.entries.clear();
    this.order.length = 0;
    this.listeners.clear();
    if (warmHost && warmHost.childElementCount === 0) {
      warmHost.remove();
      warmHost = null;
    }
  }
}

/** Every asset key, for exhaustive iteration. */
export const ALL_ORIGIN_KEYS = Object.keys(ORIGIN_MEDIA) as OriginMediaKey[];
