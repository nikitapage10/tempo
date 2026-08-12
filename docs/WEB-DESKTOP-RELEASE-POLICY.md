# Web + Desktop Release Policy

TEMPO is one product with two delivery targets:

- The web app is deployed by Vercel from `main`.
- TEMPO Desktop is an Electron shell that loads that same production web app.

This means a normal web deployment is already delivered to people using the
desktop app. Do not copy React pages, components, or product logic into the
`electron/` folder. A new desktop installer is only needed when the native
shell itself changes.

## The release rule

Every change must be classified before it is merged:

| Change type | Examples | What ships | Required checks |
|---|---|---|---|
| Shared web | Pages, components, styling, API routes, Supabase queries | Vercel deploy only; desktop receives it when it reloads | Browser regression plus the same flow inside the Electron development shell |
| Desktop-native | Window, tray, updater, vault, protocol handlers, preload bridge, installer permissions | New desktop release | Desktop version bump, packaged-app smoke test, publish through the Desktop Release workflow |
| Cross-boundary | Web UI calls a new preload/IPC capability | Native release first, web enablement second | Capability detection, fallback for older installs, then staged web rollout |

When a web change does not use a native capability, do **not** rebuild the
installer just to keep the two products in sync. Both targets are already
running the same deployed web code.

## Non-negotiable compatibility rules

1. **One shared product surface.** Product UI and business logic stay in the
   Next.js app. Electron contains only operating-system integration.
2. **Test every web change in both contexts.** Before merging a user-facing
   web change, run it in a normal browser and with `npm run desktop:dev`
   pointed at the branch/local app when the change could behave differently
   in Electron (downloads, links, auth, offline behavior, storage, window
   sizing, keyboard shortcuts, or desktop-only controls).
3. **Never assume every desktop install is current.** Web code must detect a
   bridge method or capability before calling it and must retain a safe web
   fallback. Do not gate only on a version string when capability detection is
   possible.
4. **Ship native-first for cross-boundary work.** Publish the compatible
   desktop shell, allow it to update, and only then deploy web code that uses
   the new capability. Keep the fallback until the minimum supported desktop
   version has intentionally changed.
5. **Database and API changes remain backward compatible.** An installed
   shell can be old even though its renderer is current. Add fields and routes
   before using them; do not make a web deployment depend on an installer
   landing at exactly the same time.
6. **The update feed must be public, but the source can remain private.** A
   customer installation cannot authenticate to TEMPO's private source repo.
   Desktop release assets therefore live in a separate public, binary-only
   GitHub repository: `nikitapage10/tempo-desktop-releases`.
7. **Never overwrite a released version.** If a desktop release is bad, fix it
   and publish a higher version. Updaters compare version numbers and cache
   release metadata.

## Version ownership

TEMPO intentionally has two version numbers:

- `package.json` and `lib/version.ts` are the web/product release version.
- `electron/package.json` is the installed native shell version. Its
  `version` and `build.extraMetadata.version` must match.

The numbers do not need to match each other. A web-only release changes only
the web/product version. A native-shell release changes the desktop version
as well and is recorded in `CHANGELOG.md`.

## Desktop update channel

Packaged desktop builds use `electron-updater`. They check the public
`tempo-desktop-releases` repository **on first launch** and every six hours
while the app remains open. When a newer release exists, the update is
downloaded in the background. Once it is ready, TEMPO shows the same
desktop-only in-app banner used for a newly deployed web version: **Update now**
applies it, while **After this session** dismisses the prompt for the current
app session. The copy never asks the artist to distinguish between web and
native delivery. TEMPO does not restart or interrupt active work automatically;
a downloaded native update can still install on a normal full quit.

**Important split:** ordinary product/UI changes on `main` update desktop
through the live web app — no new installer. A new installer is published only
when the native shell under `electron/` changes (or via the daily catch-up /
manual Desktop Release run).

### When Desktop Release publishes

The `Desktop Release` GitHub Actions workflow publishes Windows + Mac to the
public channel when:

1. Someone pushes to `main` and the diff touches `electron/**`, the desktop
   release check script, or the workflow file itself (not every web-only push).
2. A daily scheduled catch-up runs (`14:00 UTC`) and the current desktop
   version is not already tagged on `tempo-desktop-releases`.
3. Someone runs the workflow manually (`workflow_dispatch`).

Web Download / Update links use `/api/desktop/windows` and `/api/desktop/mac`.
Those routes ask GitHub which release is currently `latest` and redirect to that
exact Windows or Mac asset — so a newly published Desktop Release shows up on
the Download page **immediately**, without waiting for a web redeploy. If the
channel is empty, Windows falls back to the bundled beta under `/downloads`;
Mac returns 404 until a DMG exists. A small `/api/desktop/latest` probe powers
the version label on the Download page.

The public release repository contains binaries and update metadata only, not
TEMPO source code. A Windows release must contain at least:

- `TEMPO-Setup.exe` (assisted wizard: welcome, install folder, shortcuts)
- `TEMPO-Setup.exe.blockmap`
- `latest.yml`

A Mac release (same tag) must contain at least:

- `TEMPO-Mac.dmg`
- `TEMPO-Mac.dmg.blockmap`
- `latest-mac.yml`

`latest.yml` / `latest-mac.yml` are the maps the installed app reads to learn
the newest version and verify the downloaded file.

## One-time update-channel setup

1. Create a **public** GitHub repository named
   `nikitapage10/tempo-desktop-releases`. Do not put source code or secrets in
   it.
2. Create a fine-grained GitHub token that can write repository contents for
   that release repository only.
3. In the private `tempo` source repository, add that token as an Actions
   secret named `DESKTOP_RELEASE_TOKEN`.
4. Run the `Desktop Release` workflow manually. It validates the desktop
   version, builds the Windows installer, and publishes the installer plus
   updater metadata to the public release repository.
5. Confirm the release assets are publicly downloadable in a signed-out
   browser.
6. Confirm the release assets are publicly downloadable in a signed-out
   browser. The web app’s `/api/desktop/windows` and `/api/desktop/mac`
   redirects prefer those `latest` assets automatically (Windows falls back to
   the bundled `/downloads/TEMPO-Setup-0.100.6.exe` if the channel is empty).
   Optional: set `NEXT_PUBLIC_DESKTOP_WINDOWS_URL` /
   `NEXT_PUBLIC_DESKTOP_MAC_URL` in Vercel only if you need to pin a specific
   asset instead of `latest`.
7. In Vercel project settings, keep **Automatically expose System Environment
   Variables** enabled. The unified desktop banner uses
   `VERCEL_GIT_COMMIT_SHA` to notice every newly deployed build, with the
   required TEMPO product-version bump as its fallback.

The existing `0.100.6` Windows beta was built against the private source
repository's update feed. It cannot discover the new public feed. Existing
beta users need to install the first public-channel build once by hand; all
later releases can update automatically.

## Desktop release checklist

1. Finish and review all native changes under `electron/`.
2. Bump both desktop version fields in `electron/package.json` and the root
   entry for that package in `electron/package-lock.json`.
3. Add a plain-English `CHANGELOG.md` entry.
4. Run `npm run check:desktop-release`.
5. Build and install locally with `npm run desktop:build`; verify sign-in,
   window/tray behavior, external links, vault playback, quit, and relaunch.
6. Merge the tested commit to `main`. If the commit touches `electron/**`
   (or the desktop release workflow/check), Desktop Release runs
   automatically; otherwise run GitHub Actions → `Desktop Release` →
   `Run workflow` when you still need a new public installer (or wait for
   the daily catch-up if that version was never published).
7. Verify the public release has the Windows installer, blockmap, and
   `latest.yml`, plus the Mac `TEMPO-Mac.dmg` and `latest-mac.yml`.
8. From the previous installed version, check that the update downloads and
   installs after a full quit/relaunch.

For a broad public launch, code-sign the Windows installer before publishing.
Unsigned beta releases trigger SmartScreen and reduce trust. Mac ships the
same way for now: an **unsigned** universal DMG from GitHub Actions
(`macos-latest`), opened the first time via right-click → **Open**. Apple
signing and notarization can replace that path later; until then Gatekeeper
warnings are expected, not a broken build.

The Desktop Release workflow builds Windows first, then Mac, so both assets
land on the same public release (`TEMPO-Setup.exe`, `latest.yml`,
`TEMPO-Mac.dmg`, `latest-mac.yml`).

## Mac ↔ Windows shell parity — REQUIRED

TEMPO Desktop is one product on two OS installers. Keep them aligned:

1. **One shared shell.** Put native behavior in shared `electron/` modules
   (`main.js`, preload, vault, OAuth navigation, updater). Prefer
   `process.platform` branches inside shared code over separate Mac/Windows
   feature forks.
2. **Same version, same capabilities.** A desktop version bump that changes
   customer behavior (production URL, auth bridge, vault, updates, window
   chrome) must be available on **both** Windows and Mac for that version.
   Do not publish a “Windows-only” or “Mac-only” customer fix as the latest
   channel tip.
3. **Release gate.** After Desktop Release finishes, confirm the public
   `vX.Y.Z` tag includes Windows (`TEMPO-Setup.exe`, `latest.yml`) **and**
   Mac (`TEMPO-Mac.dmg`, `latest-mac.yml`). If Mac failed, fix and republish
   a higher version — never leave `latest` pointing at a one-platform cut.
4. **Test both when native.** For desktop-native or cross-boundary work,
   smoke the flow on Windows and Mac (or the matching CI artifacts) before
   calling the release done. Platform-specific UI affordances (traffic
   lights, tray quirks) are fine; missing features on one OS are not.
5. **Web stays shared.** Product UI still ships once via Vercel and loads in
   both shells — Mac/Windows parity for studio features is automatic unless
   you branch on `platform` in the web app. Avoid web `platform === "mac"` /
   `"windows"` gates unless the OS truly requires different behavior.

## Rollback

- **Web regression:** promote the previous Vercel deployment, then fix forward.
- **Desktop regression:** stop directing new downloads to the bad release if
  necessary, fix the shell, bump its version, and publish a new release. Do
  not replace assets inside an existing version.
- **Cross-boundary regression:** disable the web-side feature first so older
  and affected desktop shells fall back safely, then release the native fix.
