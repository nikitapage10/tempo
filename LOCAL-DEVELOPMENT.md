# Local development — run TEMPO on your machine

Use this when the GitHub repo already exists and you want to **test changes locally**, then push, then deploy. For a brand-new build from the kit, see `START-HERE.md` instead.

## What “local” means here

- The **app** (Next.js) runs on your computer at http://localhost:3000.
- **Data** (auth, tracks, audio files) still lives in **Supabase** — same pattern as production.
- Prefer a **separate Supabase project** named something like `tempo-dev` for day-to-day testing so you never risk production music data. Point production Vercel at the live project only.

You do **not** need Docker or a local Postgres for normal work.

---

## One-time setup (Windows)

Your project folder should be a **clone of the GitHub repo**:

`C:\Users\nikit\Documents\TEMPO`

### 0. If you already have a TEMPO folder that isn’t Git

PowerShell errors like `not a git repository` or `Missing script: "setup"` mean that folder is an old/copied kit, not the GitHub repo. Replace it:

```powershell
cd C:\Users\nikit\Documents
Rename-Item TEMPO TEMPO-old-backup
git clone https://github.com/nikitapage10/tempo.git TEMPO
cd TEMPO
git checkout cursor/local-dev-setup-7300
```

(That branch has `npm run setup` and the Windows launcher. After the PR merges to `main`, you can use `git checkout main` instead.)

If anything important was only in the old folder (e.g. an existing `.env.local`), copy it back:

```powershell
Copy-Item C:\Users\nikit\Documents\TEMPO-old-backup\.env.local C:\Users\nikit\Documents\TEMPO\.env.local -ErrorAction SilentlyContinue
```

Then continue from step 2 below.

### 1. Open it in Cursor

**File → Open Folder** → pick `C:\Users\nikit\Documents\TEMPO`.

Or in PowerShell:

```powershell
cd C:\Users\nikit\Documents\TEMPO
```

Fresh clone (only if `TEMPO` does **not** already exist):

```powershell
cd C:\Users\nikit\Documents
git clone https://github.com/nikitapage10/tempo.git TEMPO
cd TEMPO
git checkout cursor/local-dev-setup-7300
```

### 2. Install Node.js

Need Node **18+** (LTS from https://nodejs.org). After installing, open a **new** terminal and check:

```bat
node -v
npm -v
```

### 3. Run setup

```bat
cd C:\Users\nikit\Documents\TEMPO
npm run setup
```

That will:

1. Copy `.env.local.example` → `.env.local` if you don’t have one yet
2. Install npm dependencies
3. Tell you which env values are still blank

### 4. Fill in `.env.local`

In Cursor’s file sidebar, open `.env.local` and paste values from **Supabase → Project Settings → API**:

| Variable | Required? | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | For guest review / invites | `service_role` secret — server only |
| `INVITE_CODE` | To open `/register` | Shared code you invent |
| `OPENAI_API_KEY` | For Import Studio / AI | Optional until you use those features |

Never commit `.env.local`. Never paste these keys into chat or the repo.

### 5. Database (first time on a *new* Supabase project only)

If this Supabase project is empty:

1. SQL Editor → paste and run `schema.sql`
2. Storage → New bucket → name `audio` → leave **private**
3. Run every file in `/migrations` in order (`001` … `021`), or use `_run_all_001_to_011.sql` then run `012`–`021` one by one

If you’re pointing at the **existing production** project, skip this — the schema is already there. Be careful: local writes hit real data.

### 6. Start the app

```bat
npm run dev
```

Open http://localhost:3000. Sign in at `/login` (same accounts as that Supabase project).

**Windows shortcut:** double-click `Launch TEMPO.bat` in `C:\Users\nikit\Documents\TEMPO` (installs deps if needed, starts the server, opens the browser). Keep that window open; Ctrl+C stops it.

**Mac shortcut:** double-click `Launch TEMPO.command`.

---

## Daily loop

1. Pull latest: `git pull origin main`
2. If `package.json` changed: `npm install`
3. `npm run dev` → test at localhost:3000
4. When happy:

```bat
git add -A
git commit -m "Short description of the change"
git push -u origin your-branch-name
```

5. Open / merge a PR into `main` (or push to `main` if that’s your workflow).
6. **Vercel** auto-deploys `main` to https://tempo-ten-sigma.vercel.app (~1–2 min).
7. Other branches get preview URLs — use those for risky changes.

Confirm the version under Settings (left rail) matches the CHANGELOG entry you shipped.

---

## Useful commands

| Command | What it does |
|---|---|
| `npm run setup` | First-time (or re-) local setup |
| `npm run dev` | Dev server at localhost:3000 |
| `npm run build` | Production build (catch TypeScript / Next errors) |
| `npm run lint` | ESLint |
| `npm start` | Serve a production build locally (after `build`) |

---

## Deploy checklist

Before relying on a production deploy:

1. Vercel → Project → Settings → Environment Variables has the same keys as `.env.local` (at least URL, anon, service role; plus `INVITE_CODE` / `OPENAI_API_KEY` if you use those features).
2. Any new numbered file under `/migrations` has been run once in the **production** Supabase SQL editor.
3. Smoke-test https://tempo-ten-sigma.vercel.app/login after deploy.

Rollback: Vercel → Deployments → previous good deploy → **Promote to Production**.

More detail: `DEPLOYMENT.md`.
