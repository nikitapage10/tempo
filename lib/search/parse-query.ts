/**
 * Lightweight structured parsing for global search.
 * Pulls BPM exact/range phrases out of the query so the ranker can filter
 * tracks by number instead of substring-matching the word "bpm".
 */

export type BpmFilter =
  | { kind: "exact"; bpm: number }
  | { kind: "range"; min: number; max: number };

export type ParsedSearchQuery = {
  /** Original query, trimmed / lowercased / collapsed whitespace. */
  normalized: string;
  /** Free-text tokens left after structured BPM phrases are consumed. */
  textTokens: string[];
  bpm: BpmFilter | null;
};

const NUM = "(\\d{2,3}(?:\\.\\d)?)";
/** Hyphen, en/em dash, or "to" / "through" / "thru". */
const RANGE =
  "(?:\\s*[-–—]\\s*|\\s+(?:to|through|thru)\\s+)";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function rangeFilter(a: number, b: number): BpmFilter {
  return a <= b
    ? { kind: "range", min: a, max: b }
    : { kind: "range", min: b, max: a };
}

/**
 * Parse a search string into optional BPM filters + remaining text tokens.
 * Examples that set a BPM filter (and leave no text tokens when alone):
 *   140 bpm · bpm 140 · 140
 *   140-150 · 140 through 150 · bpm 140 to 150
 */
export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const normalized = normalize(raw);
  if (!normalized) {
    return { normalized: "", textTokens: [], bpm: null };
  }

  let bpm: BpmFilter | null = null;
  let remainder = normalized;

  const wholeRange: RegExp[] = [
    new RegExp(`^(?:bpm|tempo)\\s+${NUM}${RANGE}${NUM}$`),
    new RegExp(`^${NUM}${RANGE}${NUM}\\s*(?:bpm|tempo)$`),
    new RegExp(`^${NUM}\\s*(?:bpm|tempo)${RANGE}${NUM}\\s*(?:bpm|tempo)$`),
    new RegExp(`^${NUM}${RANGE}${NUM}$`),
  ];

  for (const re of wholeRange) {
    const match = normalized.match(re);
    if (!match) continue;
    bpm = rangeFilter(Number(match[1]), Number(match[2]));
    remainder = "";
    break;
  }

  if (!bpm) {
    const wholeExact: RegExp[] = [
      /^(?:bpm|tempo)\s+(\d{2,3}(?:\.\d)?)$/,
      /^(\d{2,3}(?:\.\d)?)\s*(?:bpm|tempo)$/,
      /^(\d{2,3}(?:\.\d)?)$/,
    ];
    for (const re of wholeExact) {
      const match = normalized.match(re);
      if (!match) continue;
      bpm = { kind: "exact", bpm: Number(match[1]) };
      remainder = "";
      break;
    }
  }

  // Embedded phrase inside a longer query — e.g. "battle bpm 140".
  if (!bpm) {
    const embedded: Array<{ re: RegExp; kind: "exact" | "range" }> = [
      {
        re: new RegExp(
          `(?:^|\\s)(?:(?:bpm|tempo)\\s+)?${NUM}${RANGE}${NUM}(?:\\s*(?:bpm|tempo))?(?=\\s|$)`
        ),
        kind: "range",
      },
      {
        re: /(?:^|\s)(?:bpm|tempo)\s+(\d{2,3}(?:\.\d)?)(?=\s|$)/,
        kind: "exact",
      },
      {
        re: /(?:^|\s)(\d{2,3}(?:\.\d)?)\s*(?:bpm|tempo)(?=\s|$)/,
        kind: "exact",
      },
    ];
    for (const { re, kind } of embedded) {
      const match = normalized.match(re);
      if (!match) continue;
      if (kind === "range") {
        bpm = rangeFilter(Number(match[1]), Number(match[2]));
      } else {
        bpm = { kind: "exact", bpm: Number(match[1]) };
      }
      remainder = normalized.replace(re, " ").replace(/\s+/g, " ").trim();
      break;
    }
  }

  let textTokens = remainder.split(" ").filter(Boolean);

  if (bpm) {
    // BPM / tempo were filter keywords — don't score them as free text.
    textTokens = textTokens.filter((t) => t !== "bpm" && t !== "tempo");
  } else if (
    textTokens.length === 1 &&
    (textTokens[0] === "bpm" || textTokens[0] === "tempo")
  ) {
    // Lone "bpm" used to match every track with a tempo via a synthetic field.
    textTokens = [];
  }

  return { normalized, textTokens, bpm };
}
