# Permissions test checklist (Prompt 10)

Manual regression checklist for track collaboration. Run this after any
change touching `track_collaborators`, RLS policies, or permission-aware UI.
Unauthorized access of any kind is a **release blocker** — see
`SECURITY-AND-PERMISSIONS.md` §5.

## Setup

You need three Supabase Auth accounts:

- **A (Owner)** — creates the track being tested.
- **B (Collaborator)** — will be invited with a specific role, one role per pass.
- **C (Outsider)** — never invited to anything, used to prove isolation.

Repeat the "Per-role checks" section once per role: Editor, Uploader,
Commenter, Viewer.

## Invite flow

1. As **A**, open a track → People tab → invite **B**'s email with the role
   under test. Confirm the invite link is shown exactly once and copying it
   works.
2. Open the invite link in a private/incognito window while signed out.
   Confirm the preview shows the track title and role without leaking the
   owner's identity or other track data.
3. Try accepting while signed out → should prompt to sign in, not error.
4. Sign in as **C** (wrong email) and open the same invite link → accept
   must fail with "sent to a different email address."
5. Sign in as **B** and accept → should redirect to the track's People tab,
   the row should flip from "pending" to "active", and **A** should get an
   "accepted your invite" notification.
6. Re-open the same invite link as **B** after accepting → should fail
   gracefully (already used / not pending).
7. Confirm an expired invite (`expires_at` in the past, set manually in
   Supabase for this test) is rejected with the generic "unavailable" message.

## Per-role checks (repeat for Editor / Uploader / Commenter / Viewer)

Sign in as **B** with the role under test active on the track.

### View
- [ ] Track workspace loads (title, waveform, checklist, notes visible).
- [ ] Notes, checklist, and references are visible per the matrix (Viewer
      gets read-only references; everyone gets read access to checklist).

### Edit metadata / workflow
- [ ] Editor: can edit artist/BPM/key/genre/tags/destination, NOW/NEXT/BLOCKED/TARGET fields.
- [ ] Uploader/Commenter/Viewer: Details fields render disabled; attempting
      a direct Supabase `update` on `tracks` from the console fails (RLS).

### Upload / manage versions
- [ ] Editor/Uploader: "Upload a bounce" is visible and works.
- [ ] Commenter/Viewer: no upload dropzone shown; a direct `insert` into
      `versions` fails (RLS `can_upload_track`).
- [ ] Editor: Set current / Pin / Delete controls visible and work.
- [ ] Uploader/Commenter/Viewer: those controls are hidden; direct
      `update`/`delete` on `versions` fails for Uploader/Commenter/Viewer.

### Comments
- [ ] Editor/Commenter: can post top-level comments and replies.
- [ ] Viewer/Uploader: composer either hidden or posting fails via RLS
      (`can_comment_track`) — no comment should land in the DB.
- [ ] Commenter: can edit/delete only their **own unresolved** comments;
      editing someone else's comment fails.
- [ ] Editor: can resolve any comment; Commenter can only resolve/reopen
      comments they can otherwise touch per RLS.
- [ ] New comments show correct attribution ("You" for the poster, "Owner"
      for A's comments, collaborator email otherwise).

### Guest links / collaborators / delete track
- [ ] People tab: only **A** (owner) sees "Invite", role dropdowns, and
      "Revoke" — **B** sees a read-only role chip for their own row (and
      cannot see the invite controls).
- [ ] Guest Review Links panel is not rendered at all for **B** (any role).
- [ ] Delete track button is not rendered for **B**; a direct `delete` on
      `tracks` fails (RLS `delete_own_tracks`).
- [ ] Direct Supabase call to change another collaborator's role or revoke
      them fails for **B** (RLS `own_track_collaborators` requires owner).

### Isolation
- [ ] **C** (never invited) cannot open the track URL directly (`/track/{id}`
      redirects or errors — no data returned).
- [ ] **C** cannot fetch the track row by guessing its UUID via the browser
      console (`supabase.from('tracks').select().eq('id', ...)` → empty).
- [ ] **B**, once revoked by **A**, immediately loses access — reload the
      track page as **B** and confirm it now 404s/redirects.

## Activity & notifications

- [ ] Uploading a version, changing stage, and posting a comment each add a
      row to the Activity tab with a human-readable summary and timestamp.
- [ ] Activity filters (Versions/Stage/Comments/People) narrow the list
      correctly.
- [ ] Uploading a new version notifies every other person with track access
      (owner + active collaborators), not the uploader themselves.
- [ ] Replying to a comment notifies the original comment's author (if
      known) — not the replier.
- [ ] Assigning a comment to someone notifies that person.
- [ ] The notification bell's unread count matches the number of unread
      rows; clicking a notification marks it read and deep-links to the
      right tab (People for invite-accepted, Comments for replies/assignment).
- [ ] "Mark all read" clears the badge.

## Regression guard

- [ ] Owner (**A**) retains full access to everything above regardless of
      any collaborator role changes.
- [ ] Removing the last collaborator doesn't affect owner access.
- [ ] None of the above ever requires disabling RLS or using the
      service-role key from the browser — service-role usage is confined to
      `app/api/invite/[token]/route.ts` and `app/api/notify/route.ts`.
