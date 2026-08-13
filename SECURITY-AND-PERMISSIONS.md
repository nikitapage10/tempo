# TEMPO — Security and Permissions

*Living document. Threat model and permissions matrix for current solo app and planned guest / collaboration features.*

**Status today:** Account ownership and collaboration are enforced through Supabase Auth + RLS. The private `audio` bucket remains private. Narrow server-only routes use the service role for guest links, notifications, external platform snapshots, and the platform Admin console.

---

## 1. Security principles

1. **RLS is authoritative** for authenticated data access. UI hiding is not security.
2. **`audio` bucket is never public.** Playback always uses short-lived signed URLs.
3. **Raw secrets and tokens are never stored** when a hash will do (guest links, invite tokens).
4. **Service-role key** only in server-only modules / route handlers — never `NEXT_PUBLIC_*`, never client bundles, never guest-visible errors.
5. **Fail closed.** Invalid guest/collaborator tokens get generic “unavailable” responses.
6. **Least privilege.** Track collaboration does not grant catalog-wide or project-wide access.
7. **No security through obscurity** for version ids — guest APIs must ignore client-supplied ids that disagree with the link record.

---

## 2. Threat model

### T1 — Guest review links
| Threat | Mitigation |
|--------|------------|
| Token guessing | Long opaque tokens; store SHA-256 only; rate/burst limits |
| Token leakage in logs | Never log raw token; show once to owner |
| Expired/revoked use | Check `expires_at` / `revoked_at` server-side every request |
| Enumerating tracks via `/review/*` | Generic unavailable; no existence oracle beyond unavoidable timing |
| Making bucket public “for guests” | Forbidden — signed URL after validation only |
| Guest reads private notes/tasks | Review page + APIs return allowlisted fields only |
| Guest posts spam | Honeypot; length limits; burst limits per link via recent rows |
| Guest escalates to edit/resolve | v1 API simply does not implement those actions; RLS/service writes constrained |

### T2 — Public comments abuse
| Threat | Mitigation |
|--------|------------|
| XSS via comment text | React text escaping; no `dangerouslySetInnerHTML` for comment bodies |
| Huge payloads | Server max length; trim; reject empty |
| Impersonation of owner | Guest rows tagged guest_name / guest_link_id; no author_user_id elevation |

### T3 — Private signed audio
| Threat | Mitigation |
|--------|------------|
| Long-lived URL sharing | 1-hour expiry (or shorter for guests if chosen) |
| URL in static HTML / CDN cache | `no-store`; fetch URL client-side after auth/validation |
| Path traversal in storage keys | `sanitizeFilename` + fixed path layout |
| Referrer leakage | Restrictive Referrer-Policy on review routes |

### T4 — Collaborator invitations (Prompt 10)
| Threat | Mitigation |
|--------|------------|
| Invite token theft | Hash at rest; expiry; revoke; single-use accept if feasible |
| Wrong account accepts | Require signed-in email match `invited_email` |
| Privilege escalation via role tampering | Role changes owner-only; server/RLS enforce |
| Lateral movement to other tracks | RLS scoped to invited `track_id` only |
| Project/task leakage via FKs | Do not grant SELECT on projects/tasks merely because `track.project_id` is set |
| Recursive RLS bugs | SECURITY DEFINER helpers for `is_track_owner` / `track_role` |

### T5 — RLS changes
| Threat | Mitigation |
|--------|------------|
| Over-broad `USING (true)` policies | Banned; review every policy in Prompt 10 |
| Breaking owner access | Explicit owner OR collaborator predicates; test matrix |
| Anon policies for convenience | Guest access via service-role after token check, not anon SELECT |

### T6 — Token / secret storage
| Secret | Storage |
|--------|---------|
| Supabase anon | `NEXT_PUBLIC_*` (expected); RLS required |
| Service role | Server env only |
| Guest raw token | Memory/URL once; DB = hash |
| Invite raw token | URL once; DB = hash |
| Signed audio URL | Client memory; not persisted in DB |

### T7 — Accidental data exposure
| Risk | Mitigation |
|------|------------|
| Error objects to guests | Map to generic messages |
| Verbose Supabase errors in toasts for guests | Separate guest error path |
| Middleware allowlist too broad | Exact `/review` and `/api/review` paths only |
| Selecting `*` on tracks for guests | Explicit column allowlists in server serializers |

### T8 — Abuse controls (pragmatic, no new deps)
- Burst comment limits per `guest_link_id` using recent `comments.created_at` counts
- Calm 429-style message without infra vendor lock-in
- Optional: CAPTCHA later — out of scope unless requested

### T9 — Platform administration

| Threat | Mitigation |
|--------|------------|
| Discovering or entering the console | No normal-app navigation; the server layout silently redirects non-admins; every API route independently requires an admin |
| Service-role key reaching the browser | Constructed only in server modules after the signed-in caller is identified; never imported by client components |
| Admin reading private creative work | Every admin database read imports a central column allowlist; no wildcard selects; member views expose identity, public profile identity, and aggregate metadata only |
| Privileged action without accountability | Suspend, reactivate, delete, invite, and moderation actions write an immutable audit row |
| UI-only suspension | Suspension updates Supabase Auth itself and mirrors the state in `account_flags` for display |
| Broad table access through RLS | Admin tables have RLS enabled and no authenticated read policies; they are accessible only through guarded server routes |
| Invite email credential exposure | The provider key and verified sender exist only in server environment variables; client code receives delivery status, never provider credentials |
| Leaking invite codes across accounts | Each email is rendered server-side for one stored invite and its bound recipient; delivery actions require the admin guard and are audited |
| Support report used to leak private workspace data | Manual reports send only user-entered text, a UUID-masked pathname, and browser information; assistant reports are instructed to use only the described issue and require confirmation |
| Reporting someone’s private content | Moderation targets are limited to a specific network post or non-private published profile; the reporting route cannot attach tracks, messages, or private profiles |

### Admin privacy boundary (explicit)

Message attachments remain in the private storage bucket. A guarded server
route issues a short-lived URL only when the requested path appears on a
non-deleted message in a conversation the caller may access, and the path must
also sit under that message sender's private storage prefix. Archive state is
per participant. Message deletion is sender-only and soft-deletes the database
row; owned attachment objects are removed on a best-effort basis.

Support conversations use a dedicated `support_messages` table rather than the
artist messaging tables. It has RLS enabled with no browser-facing policies.
Member support APIs first authenticate the caller and verify that the ticket's
`user_id` matches before a server-only service client reads or writes replies;
admin routes independently require the admin guard. Provider errors retain only
a short Resend error name/message and HTTP class, never request headers, API
keys, or provider response metadata.

Realtime inbox updates subscribe only to the signed-in user's own RLS-protected
notification rows. The event acts as an invalidation signal; clients refetch
message content through the existing conversation or guarded support APIs.
Support message bodies are never published to a shared realtime topic.

**May see:** auth email, provider, account creation and last sign-in times; published profile handle, display name, and visibility; aggregate track/project counts, storage bytes, and assistant usage totals; invite redemption; account-event types and timestamps; and the exact public post, public comment, or published profile attached to a moderation report.

For support reports, an admin may additionally see the subject/details the member intentionally submitted, its bug/help/feedback category, a UUID-masked page path, browser identification, submission source, and support status/notes.

**Must not see:** track, project, or version names; audio paths or signed URLs; lyrics; notes or board notes; checklist contents; feedback; ordinary comments; session contents; direct messages; private profile fields; or private contact-book entries.

Aggregate analytics may read only counts, timestamps, byte sizes, assistant request totals, and focus-session duration/status. The analytics API does not select creative names, file paths, session notes or goals, message bodies, or generated AI content.

---

## 3. Permissions matrix

Legend: **F** full · **R** read · **W** write/create · **O** own rows only · **—** none · **Own** track owner (`tracks.user_id`)

Roles (planned): **Owner** · **Editor** · **Uploader** · **Commenter** · **Viewer** · **Guest reviewer** (link-scoped, no account)

| Capability | Owner | Editor | Uploader | Commenter | Viewer | Guest |
|------------|-------|--------|----------|-----------|--------|-------|
| View track workspace (allowed surfaces) | F | R | R | R | R | Allowlisted review only |
| Edit metadata / notes / workflow | F | W | — | — | — | — |
| Change stage / momentum | F | W | — | — | — | — |
| Upload version / asset | F | W | W | — | — | — |
| Delete version / asset | F | W* | — | — | — | — |
| Set current / pin milestone | F | W | — | — | — | — |
| Delete track | F | — | — | — | — | — |
| Manage guest links | F | — | — | — | — | — |
| Manage collaborators / recipes | F | — | — | — | — | — |
| Checklist edit | F | W | — | — | — | — |
| Checklist read | F | R | R | R | R | — |
| Play versions | F | R | R | R | R | Linked version only |
| Download version | F | R | R | R† | R† | Only if `allow_download` |
| Create comment | F | W | — | W | — | If `allow_comments` |
| Edit/delete comment | F / own | own unresolved‡ | — | own unresolved | — | — |
| Resolve any comment | F | W | — | — | — | — |
| Reply to comment | F | W | — | W | — | — (v1) |
| Record version decision | F | W | — | — | — | — (schema later) |
| Focus session | F | W? | — | — | — | — |
| References CRUD | F | W | — | — | R | — |
| See projects/tasks/spaces list | F | —§ | — | — | — | — |
| Activity / notifications | F | own+track | limited | limited | limited | — |
| Customize workspace prefs | F | own prefs | own | own | own | — |

\* Confirm whether editors may delete pinned/current — default: editors can delete unpinned non-current with confirm; owner for dangerous cases. Finalize in Prompt 10 plan gate.  
† Product may hide download for commenter/viewer — default: allow read download for signed-in roles unless owner setting later.  
‡ Commenters: edit/delete **only their own unresolved** comments.  
§ Collaborators must not enumerate projects/tasks; if a track shows a project name, use a narrow RPC or denormalized label — decide in Prompt 10 approval.

### Artist-level team (shipped)

Separate from track collaborators. Roles: **manager**, **agent**, **tour_manager**, **label**, **assistant**, **custom**. Grants are per area (`catalog`, `calendar`, `stats`, `releases`, `performances`, `social`, `team`) at none / read / write. Managing other members is owner-only.

Team members own a **personal workspace** (`artists.workspace_kind = personal`) for their own projects/tasks. They may `SELECT` other **active** teammates of the same artist (not pending invites or token hashes) and those people's name/photo. Calendar grants also allow listing that artist's spaces. Social people badges (`network_person_badges_for`) expose role + artist name only for humans with a published profile — never grants or emails.

UI hiding (rail, Settings Account-only outside My artist, read-only Artist page in an entered workspace) is not security; RLS remains authoritative. Members never post as the managed artist.

### Guest allowlist (explicit)
**May see:** track title, artwork (signed), version number/label/changelog, waveform for linked version, comments for that version (as configured), own posted guest name.  
**Must not see:** notes, checklist, assets list (except artwork if shown), other versions, tasks, sessions, workflow fields, owner email, collaborator list, project internals, space data.

---

## 4. Middleware and route exposure

| Path | Unauthenticated | Notes |
|------|-----------------|-------|
| `/login`, `/register`, `/auth/*` | Yes | Existing |
| `/review`, `/review/[token]` | Yes | Prompt 4 |
| `/api/review/*` | Yes + server validation | Exact paths only |
| `/invite/[token]`, `/team-invite/[token]` | Landing may be public; accept requires auth + matching email | Prompt 10 / team |
| `/api/auth/verify-invite`, `/api/auth/redeem-invite` | Yes; redemption still requires an authenticated signup session. A pending team or track invite token bound to the same email may stand in for a platform invite code — it does not open signup for other addresses. | Registration gate |
| `/admin/*`, `/api/admin/*` | No | Session required; server guard additionally requires `platform_admins` membership |
| All `app/(app)/*` | No | Redirect login |

---

## 5. Verification requirements (Prompt 10)

- Two test accounts + one unauthorized account
- Direct Supabase queries must fail for disallowed roles
- Collaborator cannot fetch other tracks by UUID guessing
- Guest cannot change `version_id` in API body to another bounce
- Unauthorized access = **release blocker**

---

## 6. Unresolved decisions (blocking only for Prompt 10+)

| Decision | Why it matters | Blocks Prompt 1–9? |
|----------|----------------|--------------------|
| Exact editor delete powers | RLS policies | No |
| Whether commenters can download | Product | No |
| Project name visibility on shared tracks | Data leak risk | Prompt 10 only |
| Invite single-use vs multi-open before accept | Token theft window | Prompt 10 only |

Prompt 4 guest work can proceed with the matrix above for Guest column.
