# TEMPO local preview

TEMPO has one local preview slot for every coding tool and worktree:

**http://localhost:3000**

Do not start Next.js directly, choose another port, or accept an automatic
fallback port. Those shortcuts create stale tabs, split browser sessions, and
make it unclear which branch is being reviewed.

## Everyday use

From any TEMPO worktree:

- `npm run dev` starts the shared preview if it is stopped, or reuses it if it
  is already running.
- `npm run dev:status` shows the branch and worktree currently being previewed.
- `npm run dev:switch` deliberately moves the shared preview to the current
  worktree. Use this only when the product owner asks to review that branch.
- `npm run dev:stop` stops the coordinated preview.

The server runs in the background and writes its output to the log path shown
by `npm run dev:status`. It refuses to move to another port when port 3000 is
occupied by an unrelated process.

Automated test servers may use their isolated ports while a test suite is
running. They are not human preview URLs and should close with the test run.

## Worktrees and environment settings

A Git worktree does not normally receive the repository's gitignored
`.env.local`. The coordinator first uses a `.env.local` in the current
worktree, then safely falls back to the one in the primary shared checkout.
It loads the values into the server process without copying, printing, or
committing the file.

If the shared checkout cannot be discovered, set `TEMPO_SHARED_ENV_FILE` to an
absolute `.env.local` path before starting the preview.

## Local sign-in

Add this local-only setting to the primary checkout's `.env.local`:

```text
DEV_PREVIEW_EMAIL=the-address-of-an-existing-tempo-account
```

Also keep `SUPABASE_SERVICE_ROLE_KEY` configured there. Then opening a protected
page at localhost signs that existing account in through TEMPO's local-only
session endpoint. Agent browsers do not need the password and do not need to
complete an external sign-in flow. The preview identity is never created when
the address is mistyped.

The session endpoint requires development mode, a loopback host, and the local
email setting. It returns 404 in production and through non-loopback hosts.
Never configure `DEV_PREVIEW_EMAIL` in Vercel.

`DEV_TEST_EMAIL` remains available for automated tests that need a disposable
account. Unlike the preview identity, that fixture may be created on first use.

TEMPO's live data still comes from Supabase, so the computer running the local
server needs network access to Supabase. Start `npm run dev` through the coding
tool's network-enabled or approved execution mode. `npm run dev:status` reports
whether the shared server can reach the backend. If it says the backend is
unavailable, run `npm run dev:stop` and restart it with network permission.
The local session path removes the need for an agent-controlled browser to
handle credentials; it is not an offline database replacement.

## Agent rule

Agents may run `npm run dev` to ensure the canonical preview exists. They must
not run `npm run dev:switch` merely because they started a task: switching the
visible branch is a user-facing action and should happen only for a requested
review. Before reporting a local URL, run `npm run dev:status` and name the
branch it is actually serving.

When an agent starts the server, it must use its tool's approved network-capable
execution mode. A sandboxed server that cannot reach Supabase is not a usable
authenticated preview and must not be reported as ready.
