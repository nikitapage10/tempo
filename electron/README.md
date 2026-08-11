# TEMPO Desktop (Electron shell)

Package 1 of the TEMPO Desktop program — see `planning/desktop/` at the repo
root for the full spec. This folder is a **separate npm package** on purpose:
Electron's install pulls down a ~150 MB Chromium binary, and the root
`package.json` is what Vercel installs for every production deploy of the
web app. Keeping it isolated here means the web deploy never touches it.

## Local development

```bash
npm install                 # from electron/, once
npm run dev                 # launches the shell against the production URL
```

To point the shell at a local `next dev` server instead, set
`TEMPO_DESKTOP_URL` before running:

```bash
TEMPO_DESKTOP_URL=http://localhost:3000 npm run dev
```

Never hardcode a localhost URL anywhere that ships — see the repo's
`.cursorrules`. `main.js` defaults to the production origin precisely so a
build with no env var set is always safe to hand to an artist.

## From the repo root

`npm run desktop:dev` and `npm run desktop:build` (defined in the root
`package.json`) proxy into this package, so you don't have to `cd` in for the
common case.

## What's implemented (Package 1)

- Window + tray/menu-bar residency; closing the window hides it rather than
  quitting, as long as background sync is on.
- Launch-at-login via `app.setLoginItemSettings`.
- A background sync-tick stub on a 5-minute interval — the seam later
  packages (media vault, offline cache) attach real work to.
- Auto-update checks via `electron-updater` at launch and every six hours,
  pointed at the public, binary-only `tempo-desktop-releases` repository.
  Updates download quietly and install after a full quit.
- A narrow `window.tempoDesktop` bridge (`isDesktop`, `platform`,
  `appVersion`) that the web app's download button reads to hide itself when
  running inside the shell.

## Not yet implemented

Everything in packages 2–5 of `planning/desktop/03-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md`:
the local media vault, the version-history badges, offline read, offline
write. `main.js` and `preload.js` are deliberately small so those land as
additions to this seam, not a rewrite of it.

## Publishing an update

Do not publish from a developer machine. Follow
`docs/WEB-DESKTOP-RELEASE-POLICY.md`, bump both desktop version fields, run
`npm run check:desktop-release` from the repo root, and smoke-test the packaged
installer. After the change is merged to `main`, manually run the
**Desktop Release** GitHub Actions workflow. It publishes the installer,
blockmap, and `latest.yml` to the public update repository.

The workflow needs the source repository Actions secret
`DESKTOP_RELEASE_TOKEN`, scoped only to write releases in
`nikitapage10/tempo-desktop-releases`.
