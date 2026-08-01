/**
 * ORIGIN media manifest — the single place source paths are written down.
 *
 * The sequence mapping is authoritative and does NOT follow the alphabetical
 * order of the delivered filenames. It was supplied with the assets; the
 * original name each file arrived under is recorded here so the mapping can be
 * audited without digging through git history.
 *
 * All ten videos are 1920x1080 h264, 24fps, and carry an AAC track that is
 * never played — every element mounts muted. See ARTIST-ORIGIN-ONBOARDING-SPEC.md
 * for the delivery inspection (bitrates, faststart, keyframe density).
 */

export type OriginMediaMode = "transition" | "loop" | "scrub";

export type OriginMediaId =
  | "opening-01-02"
  | "loop-02"
  | "transition-02-03"
  | "loop-03"
  | "transition-03-04"
  | "loop-04"
  | "transition-04-05"
  | "loop-05"
  | "transition-05-06"
  | "scroll-06";

export type OriginMediaAsset = {
  id: OriginMediaId;
  mode: OriginMediaMode;
  src: string;
  poster?: string;
  /** Optional held image for a clip's last frame, used at an exit seam. */
  finalPoster?: string;
  preload: "auto" | "metadata" | "none";
  /** Filename as delivered, before normalization. Audit trail only. */
  sourceName: string;
  /** Seconds, from ffprobe. Used to size buffered-range readiness checks. */
  duration: number;
};

const DIR = "/onboarding/origin";

export const ORIGIN_MEDIA = {
  opening01To02: {
    id: "opening-01-02",
    mode: "transition",
    src: `${DIR}/opening-01-02.mp4`,
    poster: `${DIR}/frame-01.jpg`,
    preload: "auto",
    sourceName: "first trans.mp4",
    duration: 6.06,
  },
  loop02: {
    id: "loop-02",
    mode: "loop",
    src: `${DIR}/loop-02.mp4`,
    poster: `${DIR}/frame-02.jpg`,
    preload: "auto",
    sourceName: "2 Loop.mp4",
    duration: 5.06,
  },
  transition02To03: {
    id: "transition-02-03",
    mode: "transition",
    src: `${DIR}/transition-02-03.mp4`,
    preload: "auto",
    sourceName: "second trans.mp4",
    duration: 4.06,
  },
  loop03: {
    id: "loop-03",
    mode: "loop",
    src: `${DIR}/loop-03.mp4`,
    poster: `${DIR}/frame-03.jpg`,
    preload: "auto",
    sourceName: "3 loop.mp4",
    duration: 6.08,
  },
  transition03To04: {
    id: "transition-03-04",
    mode: "transition",
    src: `${DIR}/transition-03-04.mp4`,
    preload: "metadata",
    sourceName: "third trans.mp4",
    duration: 5.06,
  },
  loop04: {
    id: "loop-04",
    mode: "loop",
    src: `${DIR}/loop-04.mp4`,
    poster: `${DIR}/frame-04.jpg`,
    preload: "metadata",
    sourceName: "4 loop.mp4",
    duration: 6.08,
  },
  transition04To05: {
    id: "transition-04-05",
    mode: "transition",
    src: `${DIR}/transition-04-05.mp4`,
    preload: "metadata",
    sourceName: "4 trans.mp4",
    duration: 6.06,
  },
  loop05: {
    id: "loop-05",
    mode: "loop",
    src: `${DIR}/loop-05.mp4`,
    poster: `${DIR}/frame-05.jpg`,
    preload: "metadata",
    sourceName: "5 loop.mp4",
    duration: 6.08,
  },
  transition05To06: {
    id: "transition-05-06",
    mode: "transition",
    src: `${DIR}/transition-05-06.mp4`,
    finalPoster: `${DIR}/frame-05-06-final.jpg`,
    preload: "metadata",
    sourceName: "fifth trans.mp4",
    duration: 6.06,
  },
  scroll06: {
    id: "scroll-06",
    mode: "scrub",
    src: `${DIR}/scroll-06.mp4`,
    // The spec named `frame 6 second option.png`; that file was not present in
    // the delivered folder, so this poster is the first frame of scroll-06
    // itself — which is the frame the chapter opens on anyway.
    poster: `${DIR}/frame-06.jpg`,
    finalPoster: `${DIR}/frame-06-final.jpg`,
    preload: "metadata",
    sourceName: "6 scroll.mp4",
    duration: 10.05,
  },
} satisfies Record<string, OriginMediaAsset>;

export type OriginMediaKey = keyof typeof ORIGIN_MEDIA;

/** Transition → destination handoffs, in play order. */
export const ORIGIN_HANDOFFS: Array<[OriginMediaKey, OriginMediaKey]> = [
  ["opening01To02", "loop02"],
  ["transition02To03", "loop03"],
  ["transition03To04", "loop04"],
  ["transition04To05", "loop05"],
  ["transition05To06", "scroll06"],
];

export function originAsset(key: OriginMediaKey): OriginMediaAsset {
  return ORIGIN_MEDIA[key];
}
