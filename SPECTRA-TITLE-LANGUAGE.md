# Spectra Title Language

*Living document. Design-first visual cipher: a track title shapes a Spectra
composition of vertical light slits. Not meant to be decoded by humans —
identity and rhythm, not readable text.*

Used today for temporary cover art on Today when a track has no uploaded
artwork. The pure mapping lives in `lib/spectra-title-language.ts` so other
surfaces can reuse the same score later.

---

## Intent

- **Design first.** Bars should feel like TEMPO’s intro field (vertical ice /
  white / amber / gray slits on black), not a barcode of the title.
- **Title-shaped.** Different titles produce different compositions; the same
  title is stable across renders.
- **Whole title participates.** Parentheticals, featuring credits, brackets,
  and similar extras are kept for the motif (punctuation becomes word breaks).
  Stored titles are never rewritten — this is art-only.
- **Digits are letters.** `0`–`9` participate like alphabet characters — each
  has its own hue / length / weight / register.
- **Dense enough to read as a field.** Short titles repeat; common letters
  carry real weight so sleeves don’t look sparse. Long titles are capped so
  the composition stays calm.
- **Palette:** ice (blue), white, amber (warm yellow), gray — **no violet**.

---

## Glyph anatomy

One glyph = one vertical light slit with four channels:

| Channel | Options | Visual |
|--------|---------|--------|
| **Hue** | ice · white · amber · gray | Color family |
| **Length** | short · medium · tall · peak | Glow height |
| **Weight** | thin · medium · thick | Slit width |
| **Register** | high · mid · low | Vertical seat of the bright core |

---

## Motif pipeline

1. **Normalize for art:** turn `()[]{}` and light punctuation into spaces so
   `(feat. Lena)` becomes words that still contribute glyphs.
2. Split into words. Keep letters, digits, and `&`.
3. Build a candidate sequence:
   - Word-initial letters/digits first (identity pulse).
   - Then remaining letters/digits from each word.
4. **Cap at 18.** If over: keep all word-initials, then take every other
   leftover until ≤ 18.
5. **Floor at 14** (pad up to 20). If under: alternate **forward repeats** and
   **mirrors** of the base motif until the floor — short titles should feel
   full, not lonely.
6. Mark **word boundaries** so layout can add a slightly wider gap after the
   last glyph of each word.

---

## Hue

**Vowels set the running base hue** for following glyphs until the next vowel:

| Letter | Hue | Feel |
|--------|-----|------|
| A, O | amber | warm |
| E, I | ice | cool |
| U, Y | white | bright / center |
| *(none yet)* | white | default |

**Consonant tint** (accent; rare letters get gray):

| Class | Letters | Effect |
|-------|---------|--------|
| Bright | S, T, C, Z | nudge toward white |
| Warm | R, B, M, P, F, W | nudge toward amber |
| Cool | L, N, D, G, H | nudge toward ice |
| Rare | J, Q, X, V, K | **gray** (accent slit) |

---

## Length

Alphabet band:

| Band | Length |
|------|--------|
| A–I | short → medium |
| J–R | medium → tall |
| S–Z | tall → peak |

---

## Weight (frequency-first)

| Band | Letters | Weight | Role |
|------|---------|--------|------|
| Very common | E T A O I N S H R | **medium** | Body of the field |
| Mid common | D L C U M W F G Y P | **thin** | Breathing room |
| Uncommon / rare | B V K J X Q Z (etc.) | **thick** | Accents |

**Word-initials** bump one step up (thin→medium, medium→thick) as downbeats.

---

## Register

| Letters | Register |
|---------|----------|
| B, D, F, H, K, L, T | high |
| A, C, E, M, N, O, R, S, U, V, W | mid |
| G, J, P, Q, Y, Z | low |

---

## Digits & symbols

| Char | Hue | Length | Weight | Register |
|------|-----|--------|--------|----------|
| 0 | amber | short | medium | low |
| 1 | ice | short | medium | high |
| 2 | ice | medium | medium | mid |
| 3 | white | medium | medium | mid |
| 4 | white | tall | medium | high |
| 5 | amber | tall | medium | mid |
| 6 | amber | peak | thick | low |
| 7 | gray | medium | thick | high |
| 8 | white | tall | medium | mid |
| 9 | ice | peak | thick | low |
| & | white | medium | thick | mid |

---

## Layout (covers)

- **Vertical slits** from the title score — mid-range heights (not extreme
  short/tall).
- Light group blur (~1–1.7px). Brightness peaks toward the composition’s
  mass center; edges and slit tips stay quieter.
- **Backdrop distinction:** six Spectra ground compositions (ice bloom, amber
  pool, diagonal split, soft horizons, corner frames, soft striped well) —
  same ice/white/amber/gray palette, different layouts per track.
- Respect `prefers-reduced-motion` (static slits).

---

## Non-goals

- Not a readable encoding or easter-egg cipher for users.
- Does not change stored titles, imports, or catalog data.
- Does not replace uploaded artwork — placeholders only until art exists.
- No violet / purple in this language.
