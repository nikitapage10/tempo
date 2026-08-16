# TEMPO — Testing Strategy

*Living document. Manual regression is the primary quality bar until an automated stack is explicitly approved (optional Prompt 13). This package adds **no** test dependencies.*

---

## 1. Principles

1. Every work package ends with a **short manual checklist** in the agent’s report.
2. Test against **real flows** the musician uses: sign-in, board drag, upload bounce, play, checklist, Today.
3. Prefer **preview deploys** for risky packages (especially Prompt 10) before promoting to production.
4. **Never** point automated tests at the live production Supabase project with real music data.
5. Respect `prefers-reduced-motion` and mobile/PWA in every major UI package.

---

## 2. Manual regression matrix (core — always)

Run after any package that touches shell, auth, storage, or track workspace.

### Desktop
- [ ] Sign in / sign out; register path if touched
- [ ] Rail nav: Today, Board, Tracks, Projects, Tasks, Settings
- [ ] Space switcher; stage editor smoke
- [ ] Board drag between stages; optimistic UI recovers on failure
- [ ] Open track; edit title; momentum; deadline; notes autosave
- [ ] Upload version (mp3); play waveform; set current; download; delete confirm
- [ ] Upload wav/aiff conversion path if available
- [ ] Assets upload (artwork sets cover)
- [ ] Checklist toggle/reorder; template apply
- [ ] Session log
- [ ] Tasks / Projects attach-detach smoke
- [ ] Version under Settings matches `package.json`

### Mobile (~320–390px)
- [ ] Bottom tab bar usable; no content under safe areas
- [ ] Track page readable; no accidental horizontal page scroll
- [ ] Uploads and dialogs usable with thumb reach

### Reduced motion
- [ ] OS/browser reduced motion: no shader thrash; intro skipped/static; tint static

### Auth
- [ ] Logged-out user cannot open `/board` or `/track/[id]` (redirect login)
- [ ] Logged-in user hitting `/login` redirects home

### Private storage
- [ ] Audio plays via signed URL; bucket remains private in Supabase dashboard
- [ ] Artwork loads; broken path shows calm failure

### Version pruning (today: keep 2)
- [ ] Third upload removes oldest storage + row
- [ ] After Prompt 5: pinned preserved; two newest unpinned; current never pruned

### Offline / PWA
- [ ] Installable; `start_url` is production URL in shipped manifest
- [ ] Relaunch opens app shell; auth session behavior acceptable
- [ ] Focus mode (when shipped) works installed; End reachable

---

## 3. Feature-specific manual suites (as packages ship)

### Guest links (Prompt 4) — security checklist
- [ ] Valid token: play + comment per flags
- [ ] Invalid / expired / revoked: generic unavailable
- [ ] Download off: no control + no API download path
- [ ] Download on: deliberate download works
- [ ] Direct API tampering (wrong version id, forged body): rejected
- [ ] Owner sees guest comments; revoke keeps old comments
- [ ] Private app routes still auth-gated
- [ ] Service-role errors never shown to guest

### Comments (Prompt 3)
- [ ] Comments at start / middle / end on ≥2 versions
- [ ] Cross-version seek switches version then seeks
- [ ] Resolve/reopen; delete confirm; dense markers accessible via list

### Collaboration RLS (Prompt 10) — release blocker if fail
- [ ] Matrix for owner/editor/uploader/commenter/viewer
- [ ] Unauthorized account denied on direct queries
- [ ] No cross-track enumeration
- [ ] Invite email mismatch rejected

### Stage recipes (Prompt 6)
- [ ] Board drag + timeline + dropdown all trigger once
- [ ] Preview deselect / skip / automatic undo
- [ ] Partial failure retry; duplicate checklist skip

### Focus (Prompt 7)
- [ ] Refresh persistence; second-tab conflict; 24h recovery; abandon

### Release (Prompt 9)
- [ ] General vs Single/EP; date shift preview; CSV export; old projects

### Workspace prefs (Prompt 11)
- [ ] Each preset; precedence; isolation between two users; keyboard reorder

### Today / Board polish (Prompt 12)
- [ ] Transparent priority reasons; filters; deep links; a11y pass

---

## 4. Where automation would help later (Prompt 13 — propose first)

**Do not add dependencies in Prompt 0–12 unless the user approves Prompt 13.**

Highest value later:

| Layer | Candidates | Why |
|-------|------------|-----|
| Unit (pure functions) | Attention signals, version pruning, token hash helpers, recipe action validation, permission predicate helpers | Fast, no DB, catches logic regressions |
| Component | Workflow strip forms, comment list resolve, tab panel keyboard | Interaction regressions |
| E2E (isolated project) | Auth, upload smoke, guest review token states, recipe transition idempotency, focus session uniqueness, collaboration RLS | Cross-stack confidence |

### Constraints for future automation
- Use a **separate Supabase project** or local containers — never production data
- Prefer deterministic fixtures over live musician catalog
- Keep CI time bounded; gate flaky E2E behind explicit job

### Dependency cost (to discuss in Prompt 13)
- Unit: Vitest or Node built-in test — low cost
- Component: Testing Library — moderate
- E2E: Playwright — higher CI cost; highest confidence for guest/auth

---

## 5. Build gate

Every package: `npm run build` must pass. Fix new errors before merge. Documentation-only packages should not require feature code — only doc-adjacent or pre-existing build fixes.

---

## 6. Production verification sequence (after deploy)

1. Open https://mytempo.dev/login
2. Sign in
3. Confirm Settings version matches CHANGELOG bump
4. Smoke: Today → Board drag → open track → play current bounce
5. Run package-specific checklist items that touch production paths
6. If Prompt 4+: test one guest link created against a non-sensitive track
7. If Prompt 10+: only after non-production account testing succeeded

---

## 7. Bug report hygiene
When something fails, capture: URL, role (owner/guest/etc.), expected vs actual, console/network if relevant, and whether reduced-motion or mobile.

---

## 8. Team Operations test track

Team Operations uses the existing Vitest, Playwright, and RLS integration stack with no new test dependency. The complete package-by-package plan is in `TEAM-OPERATIONS-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md`.

Every security-sensitive package requires an isolated two-artist fixture with an artist owner for Alpha, an artist owner for Beta, one Pro shared by both with different grants, an Alpha-only Pro, a suspended former member, a track-only collaborator, an unrelated authenticated account, a guest, and a platform admin.

Release blockers:

- Direct database calls prove that Alpha cannot read the shared Pro's Beta work or schedule.
- Assignment to an inactive, unauthorized, or other-artist person is rejected.
- Suspension/revocation stops direct reads and team-room topic access immediately.
- My Work and combined schedule can be queried only by the signed-in Pro.
- Team Brief pins and room work links never grant underlying source access.
- Role-kit preview/install is personal-workspace-only, idempotent under retry/concurrency, dedupes multi-role content, and preserves edited examples during restore/removal.
- Existing owner, track collaborator, guest review, Social, Scene, Messages, Admin, and account-switch privacy tests remain green.
