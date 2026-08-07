import type {
  ArtistOriginInterpretation,
  IdentitySignal,
} from "@/lib/origin/types";
import type { Confidence } from "@/lib/ai/import-plan-schema";

/**
 * Limits mirror the check constraints in migration 042. Validating here as well
 * keeps the artist out of a database error they cannot act on.
 */
export const ORIGIN_LIMITS = {
  name: 60,
  introduction: 20000,
  direction: 4000,
  promise: 400,
  compass: 2000,
  chapterTitle: 120,
  chapterPremise: 2000,
  signalLabel: 80,
  signalText: 600,
  maxSignals: 8,
  maxTags: 12,
  storySectionTitle: 120,
  storySectionBody: 2000,
  maxStorySections: 8,
} as const;

/** Enough to interpret. Deliberately not a word count — one vivid sentence beats forty vague ones. */
export const MIN_INTRODUCTION_CHARS = 40;
export const MIN_DIRECTION_CHARS = 12;

const CONFIDENCES: Confidence[] = ["high", "medium", "low"];

export function isConfidence(v: unknown): v is Confidence {
  return typeof v === "string" && CONFIDENCES.includes(v as Confidence);
}

export type ValidationResult = { ok: true } | { ok: false; message: string };

/** Matches the artists_name_len constraint from migration 021. */
export function validateArtistName(raw: string): ValidationResult {
  const name = raw.trim();
  if (name.length < 1) return { ok: false, message: "Enter a name to continue." };
  if (name.length > ORIGIN_LIMITS.name) {
    return { ok: false, message: `Keep it to ${ORIGIN_LIMITS.name} characters or fewer.` };
  }
  return { ok: true };
}

export function validateIntroduction(raw: string): ValidationResult {
  const text = raw.trim();
  if (text.length < MIN_INTRODUCTION_CHARS) {
    return { ok: false, message: "Say a little more, and TEMPO will have something to work with." };
  }
  if (text.length > ORIGIN_LIMITS.introduction) {
    return { ok: false, message: "That's longer than TEMPO can read in one go. Trim it a little." };
  }
  return { ok: true };
}

export function validateDirection(raw: string): ValidationResult {
  const text = raw.trim();
  if (text.length < MIN_DIRECTION_CHARS) {
    return { ok: false, message: "Add a little about what is taking shape now." };
  }
  if (text.length > ORIGIN_LIMITS.direction) {
    return { ok: false, message: "That is a little too long. Trim it before continuing." };
  }
  return { ok: true };
}

function clampText(v: unknown, max: number): string {
  return typeof v === "string"
    ? v.trim().replace(/\s*—\s*/g, ", ").slice(0, max)
    : "";
}

function clampTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, ORIGIN_LIMITS.maxTags);
}

export function sanitizeSignal(raw: unknown): IdentitySignal | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const label = clampText(s.label, ORIGIN_LIMITS.signalLabel);
  if (!label) return null;
  return {
    label,
    explanation: clampText(s.explanation, ORIGIN_LIMITS.signalText),
    evidence: clampText(s.evidence, ORIGIN_LIMITS.signalText),
    confidence: isConfidence(s.confidence) ? s.confidence : "low",
  };
}

/**
 * Coerce anything claiming to be an interpretation into the exact shape the
 * database constraints accept. Used on the model's output and on drafts coming
 * back from the client — neither is trusted.
 */
export function sanitizeInterpretation(raw: unknown): ArtistOriginInterpretation {
  const r = (raw ?? {}) as Record<string, unknown>;
  const chapter = (r.currentChapter ?? {}) as Record<string, unknown>;

  return {
    artistPromise: clampText(r.artistPromise, ORIGIN_LIMITS.promise),
    creativeCompass: clampText(r.creativeCompass, ORIGIN_LIMITS.compass),
    identitySignals: Array.isArray(r.identitySignals)
      ? r.identitySignals
          .map(sanitizeSignal)
          .filter((s): s is IdentitySignal => s !== null)
          .slice(0, ORIGIN_LIMITS.maxSignals)
      : [],
    currentChapter: {
      title: clampText(chapter.title, ORIGIN_LIMITS.chapterTitle),
      premise: clampText(chapter.premise, ORIGIN_LIMITS.chapterPremise),
    },
    storySections: Array.isArray(r.storySections)
      ? r.storySections
          .map((item) => {
            const section = (item ?? {}) as Record<string, unknown>;
            const title = clampText(section.title, ORIGIN_LIMITS.storySectionTitle);
            const body = clampText(section.body, ORIGIN_LIMITS.storySectionBody);
            return title || body ? { title, body } : null;
          })
          .filter((section): section is { title: string; body: string } => section !== null)
          .slice(0, ORIGIN_LIMITS.maxStorySections)
      : [],
    suggestedGenres: clampTags(r.suggestedGenres),
    suggestedRoles: clampTags(r.suggestedRoles),
  };
}

/** The story needs at least a promise or one signal to be worth opening. */
export function hasReviewableContent(i: ArtistOriginInterpretation | null): boolean {
  if (!i) return false;
  return Boolean(i.artistPromise.trim()) || i.identitySignals.length > 0;
}
