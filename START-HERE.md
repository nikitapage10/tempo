# START HERE — Getting TEMPO Built (Plain English)

Follow these steps in order. No coding knowledge needed for setup — Cursor does the coding.

---

## Part 1: One-time setup (~30 minutes)

### Step 1. Install the tools on your Mac
1. **Cursor** — download from cursor.com and install (you have this).
2. **Node.js** — download the "LTS" version from nodejs.org and install it. This is the engine that runs the app on your computer. Just click through the installer.
3. **Git** — open the Terminal app, type `git --version`, press enter. If it asks to install developer tools, click Install. That's it.

### Step 2. Make your free accounts (all free tier)
1. **GitHub** (github.com) — this stores your app's code online.
2. **Supabase** (supabase.com) — sign in with your GitHub account. This is your database + file storage (where your tunes and data actually live).
3. **Vercel** (vercel.com) — sign in with your GitHub account. This puts your app on the internet.

### Step 3. Create your Supabase project (your database)
1. In Supabase, click **New project**. Name it `tempo`. Pick a strong database password and save it somewhere (you rarely need it, but don't lose it). Region: East US.
2. Wait ~2 minutes for it to spin up.
3. In the left sidebar click **SQL Editor** → **New query**. Open the file `schema.sql` from this kit, copy ALL of it, paste it in, click **Run**. You should see "Success." Your database now has all its tables.
4. In the left sidebar click **Storage** → **New bucket**. Name it `audio`, leave it **private**, click Save.
5. Go to **Project Settings → API**. Keep this page open — you'll copy two things from it in a minute:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public key** (a long string)

### Step 4. Create the project folder and open it in Cursor
1. Make a folder somewhere sensible, e.g. `Documents/tempo`.
2. Copy ALL the files from this kit into that folder:
   - `tempo-design-spec.md`
   - `schema.sql`
   - `PROMPTS.md`
   - `DEPLOYMENT.md`
   - `cursorrules.txt` — then RENAME it: in Cursor's file explorer (left sidebar),
     right-click it → Rename → change the name to exactly `.cursorrules` (dot first,
     no .txt). It will seem to vanish from Finder — that's normal for dot-files —
     but Cursor's sidebar still shows it, and that's where it matters.
3. Open Cursor → **File → Open Folder** → pick your `tempo` folder.

### Step 5. Let Cursor build the foundation
1. In Cursor, open the chat panel (Cmd+L).
2. Make sure it's in **Agent** mode (dropdown near the message box).
3. Open `PROMPTS.md` from this kit. Copy **Prompt 1** and paste it into the chat. Send it.
4. Cursor will create files and run commands — approve them when it asks.
5. When it says it's done, it will tell you to create a file called `.env.local`. Paste your two Supabase values from Step 3.5 into it (the prompt tells Cursor to show you exactly the format).
6. In Cursor's terminal (Terminal → New Terminal), type `npm run dev` and press enter. Open http://localhost:3000 in your browser. This is TEMPO's one shared local preview; every tool and branch reuses it. You should see the app shell. 🎉

### Step 6. Put the code on GitHub
Paste **Prompt G** from `PROMPTS.md` into Cursor chat. It will create the GitHub repo and push the code for you (it may ask you to sign into GitHub once — follow the prompts).

### Step 7. Put it on the internet with Vercel
1. Go to vercel.com → **Add New → Project** → you'll see your `tempo` repo → click **Import**.
2. Before clicking Deploy, expand **Environment Variables** and add the same two values from Step 3.5:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
3. Click **Deploy**. In ~2 minutes you get a live URL like `tempo-yourname.vercel.app`. That's your app, online.

---

## Part 2: The build loop (repeat until done)

This is your life now, and it's simple:

1. **Paste the next prompt** from `PROMPTS.md` into Cursor chat (they're in order: 2, 3, 4, 5, 6).
2. **Test it** — run `npm run dev:status` to see which branch is live. When you want the current branch on screen, run `npm run dev:switch`, then click around at localhost:3000 using the checklist at the end of each prompt. Never open a fallback port.
3. **Something broken?** Tell Cursor exactly what you saw: "When I drag a card to Mixdown, it snaps back." Screenshots help — paste them right into the chat.
4. **Happy? Ship it.** Paste this into Cursor chat:
   > Commit all changes with a short descriptive message and push to main.
5. Vercel auto-deploys. ~2 minutes later your live URL has the new version. Nothing else to do.

## Part 3: Making changes later (forever)

Same loop. Describe what you want in Cursor chat ("add a filter for BPM range on the board"), test locally, push. For **big risky changes**, first say: "Create a new branch called `experiment` for this work" — Vercel gives that branch its own preview URL, and your real app stays untouched until you're happy and tell Cursor to merge it.

If a deploy ever breaks the live site: go to vercel.com → your project → **Deployments** → click the previous good one → **Promote to Production**. You're instantly back to the working version.

## The three rules (don't skip these)

1. **Never let Cursor "reset" or "recreate" the database.** Your real music data lives there. Schema changes = migration files only (`.cursorrules` enforces this, but if Cursor ever suggests dropping tables, say no).
2. **Never paste your Supabase keys into chat, code files, or GitHub.** They live only in `.env.local` (your Mac) and Vercel's environment variables settings.
3. **One prompt at a time.** Finish and test each work package before starting the next. Cheap fast models do great with small scoped jobs and badly with "build everything."
