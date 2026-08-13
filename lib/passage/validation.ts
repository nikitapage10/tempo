import { PASSAGE_LIMITS } from "@/lib/passage/interpretation-schema";
import type { PassageInterpretation, PassageStorySection } from "@/lib/passage/types";
import { EMPTY_PASSAGE_INTERPRETATION } from "@/lib/passage/types";

/**
 * Normalizes whatever comes back from the model (or up from an edit) into
 * something the database constraints and the story scroll can both accept.
 * Strict JSON schema fixes the shape, not the lengths, so this still runs on
 * the server as well as the client.
 */

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function sections(value: unknown): PassageStorySection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = entry as Record<string, unknown> | null;
      return {
        title: text(row?.title, PASSAGE_LIMITS.sectionTitle),
        body: text(row?.body, PASSAGE_LIMITS.sectionBody),
      };
    })
    .filter((section) => section.title || section.body)
    .slice(0, 8);
}

export function sanitizePassageInterpretation(value: unknown): PassageInterpretation {
  if (!value || typeof value !== "object") return EMPTY_PASSAGE_INTERPRETATION;
  const row = value as Record<string, unknown>;
  return {
    headline: text(row.headline, PASSAGE_LIMITS.headline),
    intro: text(row.intro, PASSAGE_LIMITS.intro),
    storySections: sections(row.storySections),
  };
}

/** True when there is genuinely nothing to show and the recap should fall back. */
export function isEmptyPassageInterpretation(value: PassageInterpretation): boolean {
  return !value.headline && !value.intro && value.storySections.length === 0;
}
