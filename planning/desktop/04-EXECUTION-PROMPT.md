# Execution prompt — TEMPO Desktop

Paste this (with the package number filled in) to start implementation of one
work package. It's self-contained — written so a fresh session with no memory
of the planning conversation can act on it correctly.

---

You're implementing **Package {N}** of the TEMPO Desktop program. Before
writing any code, read these four documents in full, in this order:

1. `planning/desktop/README.md` — the binding decisions. Treat every one of
   them as a hard constraint, not a suggestion.
2. `planning/desktop/01-PRODUCT-AND-UX-SPEC.md` — what the artist sees and
   experiences.
3. `planning/desktop/02-TECHNICAL-AND-DATA-DESIGN.md` — the architecture,
   schema blueprint, and the specific existing files/seams this integrates
   with.
4. `planning/desktop/03-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md` — find Package
   {N}'s scope, its acceptance criteria, and its test-matrix entries. Do not
   start on the next package's scope even if it seems easy to fold in.

Then read `CLAUDE.md` and `.cursorrules` at the repo root — they are the
standing rules for this whole codebase and are not superseded by this
planning pack. In particular:

- **Every push requires** a version bump (`APP_VERSION` in `lib/version.ts`
  matching `package.json`), a `CHANGELOG.md` entry in plain English for a
  musician (no file paths, no component names), and a `PRODUCT.md` update if
  the feature set actually changed. A pre-push hook enforces this across the
  whole range of commits since the last push — you don't need to do it after
  every commit, just once before you're done with this package.
- **Never** drop, truncate, or reset a database table. Schema changes are
  additive, go in a new numbered file under `/migrations`, and you **stop and
  tell the user to run it manually** in the Supabase SQL editor before
  continuing with anything that depends on it. This applies directly to
  Package 3's migration.
- **Don't add a dependency without asking first** — Electron itself and its
  build tooling (`electron-builder`, the auto-updater) are already approved by
  this planning pack's binding decisions, but anything beyond that (a
  different IndexedDB wrapper, a different tray library, etc.) needs a
  check-in.
- Secrets stay in `.env.local` and Vercel env vars only. If this package
  touches anything that could expose a secret to the desktop client, stop and
  flag it rather than proceeding — the whole architecture in `02` exists to
  prevent exactly that, so treat any such discovery as a design violation, not
  a detail to work around quietly.

**Reuse, don't rebuild.** The technical design doc names specific existing
files this integrates with — `lib/storage.ts`, `lib/version-prune.ts`,
`lib/api/versions.ts`, `lib/audio-convert.ts`, `components/app-shell.tsx`,
`components/providers.tsx`. Read each one before touching it. The whole
premise of the architecture is that these already form the right seam; if you
find yourself duplicating logic that already exists in one of them, stop and
reconsider rather than pushing forward.

**Stay inside this package's scope.** Finish Package {N} completely,
including its acceptance criteria and its entries in the test matrix, then
stop and report rather than continuing into the next package. Output a short
manual test checklist at the end, per the working-style rule in
`.cursorrules`.

If anything in the planning pack conflicts with what you find in the actual
code — a file path that's moved, a assumption that doesn't hold, a detail the
docs got wrong — say so explicitly and ask before proceeding on your own
guess. The docs were written from a point-in-time read of the codebase and are
not guaranteed to still be perfectly accurate.
