# TEMPO — Team Operations Security and Permissions

*Status: Implemented v1 security contract in migrations 101–105. Production enablement still requires the direct non-production RLS matrix described here.*

**Related:** `SECURITY-AND-PERMISSIONS.md` · `TEAM-OPERATIONS-TECHNICAL-DESIGN.md` · `TEAM-OPERATIONS-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md`

---

## 1. Security invariants

1. RLS and guarded RPCs are authoritative; navigation and disabled controls are explanatory only.
2. An active team membership is required for every artist-level delegated capability.
3. Suspension, revocation, decline, expiration, or leaving invalidates delegated access immediately.
4. Assignment never grants source access. An ineligible assignment is rejected rather than treated as a shortcut around permissions.
5. A Pro's cross-artist home is private to that Pro. No artist may query it.
6. One artist relationship never reveals another artist relationship, workspace, schedule, workload, or room.
7. Team-room messages are authored by the human sender, never silently by the managed artist.
8. Service-role access is not used to make ordinary authenticated Team reads easier.
9. SECURITY DEFINER helpers accept identifiers, return booleans/IDs/allowlisted rows, set `search_path = public`, and are revoked from `public` and `anon`.
10. RLS policies must not rely on subqueries whose rows can disappear under the subqueried table's own RLS.
11. Membership/access history contains state deltas only, never creative content or secrets.
12. The private `audio` bucket remains private; file access still requires current source permission and short-lived signed URLs.
13. A role-based starter kit can write only to the caller's personal Pro workspace. Role selection is preference, never proof of employment, ownership, membership, or artist permission.

---

## 2. Identities and authority

| Identity | Authority source |
|---|---|
| Artist owner | `artists.user_id = auth.uid()` |
| Active team member | `artist_members.user_id = auth.uid()` and `status = 'active'` |
| Suspended/former member | Historical relationship only; no delegated read/write authority |
| Pro personal-home owner | Personal workspace ownership and `auth.uid()` |
| Track collaborator | Existing track-scoped role; does not become artist team member |
| Guest reviewer | Existing token-scoped guest route; no Team Operations access |
| Platform admin | Existing guarded admin boundary; does not gain routine Team or creative-content access |

A user may hold several identities simultaneously. Authorization is evaluated for the artist/source involved in the request, not from a global account-type flag.

---

## 3. Area permissions matrix

Legend: **R** readable with active grant · **W** writable with active grant · **O** owner only · **S** separately constrained RPC · **—** none.

| Capability | Owner | Area Read | Area Write | Assignee with Read | Suspended/former |
|---|---:|---:|---:|---:|---:|
| View artist identity and active workspace shell | O | R where required | R | R where required | — |
| Read catalog metadata/workflow | O | R Catalog | R Catalog | Only underlying readable source | — |
| Edit track/project metadata/workflow | O | — | W Catalog | — | — |
| Create/delete tracks, spaces, projects | O | — | — in first release | — | — |
| Play versions/read file metadata | O | R Audio | R Audio | Only if Audio R/W | — |
| Upload version/asset | O | — | W Audio | — | — |
| Delete current/pinned version or storage object | O | — | — | — | — |
| Read comments/decisions/reviews | O | R Feedback | R Feedback | Source must be readable | — |
| Comment/resolve/request review | O | — | W Feedback | Complete assigned request through S | — |
| Manage guest links | O | — | — in first release | — | — |
| Read tasks | O | R Tasks | R Tasks | R assigned task | — |
| Create/edit/assign/reschedule tasks | O | — | W Tasks | Status-only through S | — |
| Delete tasks | O | — | — in first release | — | — |
| Read calendar | O | R Calendar | R Calendar | Only underlying readable event | — |
| Create/update calendar event | O | — | W Calendar | — | — |
| Delete calendar event | O or creator policy if approved | — | — in first release | — | — |
| Read release workspace | O | R Releases | R Releases | Only underlying readable source | — |
| Edit release metadata/plan | O | — | W Releases | Complete assigned check through S | — |
| Delete release project | O | — | — | — | — |
| Read streaming/custom stats | O | R Stats | R Stats (write level normalized to read initially) | — | — |
| Read personal attributes/points/achievements | O self only | — | — | — | — |
| Read performances | O | R Performances | R Performances | — | — |
| Create/update performance | O | — | W Performances | — | — |
| Read Team Brief | O | Active member baseline plus source-specific sections | Same | Same | — |
| Edit Team Brief | O | — | S only after Team Write package | — | — |
| Read team room | O | Active member baseline | Active member baseline | Active member baseline | — |
| Send as self in team room | O | Active member baseline | Active member baseline | Active member baseline | — |
| Send as managed artist | — | — | — | — | — |
| Read active roster names/roles | O | Active member baseline | Same | Same | — |
| Invite/change grants/end another member | O | — | S only after delegated Team Write package | — | — |
| View My Work across artists | Own user only | Own user only | Own user only | Own user only | — |
| View another Pro's cross-artist workload | — | — | — | — | — |

Where “baseline” is used, the capability follows active membership itself rather than a broad content-area grant. Sensitive content inside the surface remains filtered by its own area permission.

---

## 4. Role presets are not policies

Manager, Agent, Tour manager, Label, Assistant, and Custom are application presets only. RLS never checks the role string to grant catalog data. It checks normalized effective area levels.

Required rule:

```text
team role -> suggested grants -> artist reviews -> stored areas -> RLS helpers
```

Forbidden rule:

```text
role = manager -> bypass checks
```

Changing a role without applying its defaults must not change authority. Applying new defaults is an explicit areas update recorded in history.

---

## 5. Threat model

### T1 — Cross-artist leakage through a shared Pro

| Threat | Mitigation |
|---|---|
| Artist A queries Pro's work for Artist B | My Work/schedule RPCs authorize only `auth.uid()` and have no artist-owner read path |
| Shared availability reveals another artist's schedule | Share only declared status/note/timezone, never computed conflicts or source rows |
| Cached Artist B rows appear after switching to Artist A | User+artist-scoped query keys; access-change invalidation; account-switch cache clear |
| Notification body leaks another artist | Notifications are recipient-only and contain one authorized artist context |

### T2 — Assignment used as privilege escalation

| Threat | Mitigation |
|---|---|
| Assign hidden task to unauthorized user | Transaction validates active membership and Tasks access before write |
| Assignee reads linked track/project without access | Task serializer returns linked context only when separately readable |
| Member assigns to person on another artist | Assignee eligibility scoped to task's artist, checked server-side |
| Stale client reassigns after membership suspension | RPC locks/rechecks membership and task before update |

### T3 — Coarse grant exposes private audio or feedback

| Threat | Mitigation |
|---|---|
| Legacy Catalog grant unintentionally exposes audio | Explicit compatibility migration and separate Audio area; no implicit new access |
| Signed URL remains usable after revocation | Short expiry; new signing requests denied; consider shorter team URLs if risk warrants |
| File path exposed in My Work/room snapshot | Fixed serializers exclude paths and filenames |

### T4 — Invitation deception or tampering

| Threat | Mitigation |
|---|---|
| Displayed access differs from stored access | Send/accept paths use normalized server-returned access summary |
| Client changes grants during acceptance | Invitee can only accept/decline exact stored row; cannot submit areas |
| Wrong account accepts email invite | Existing matching-email/token rules remain mandatory |
| Existing-member invite spam | Existing duplicate indexes, rate control, in-app decline; owner/inviter audit |
| Raw token appears in history | Membership events exclude tokens and emails |

### T5 — Suspension/revocation incomplete

| Threat | Mitigation |
|---|---|
| UI hides workspace but RLS still reads | Every helper requires `status = active`; direct-query tests are release blockers |
| Team room remains readable | Lifecycle transaction sets participant `left_at` before completion |
| Realtime sends after access ends | Topic authorization checks current participant; reconnect refetches membership |
| Offline cache appears current | Stale/offline label; writes fail closed; reconnect clears artist caches |

### T6 — Delegated team administration escalation

Delegated Team Write does not ship in the first permission package. Before it may ship:

- Delegator must be active with Team Write.
- They cannot alter their own membership, role, or grants.
- They cannot grant any level higher than their own effective level per area.
- They cannot grant Team Write unless the owner explicitly allows delegation.
- They cannot suspend/revoke the owner or another team administrator of equal/higher authority.
- Every action is transactional and written to membership history.
- Owner receives a grouped notification.

Until those rules and tests exist, Team Write renders Owner only.

### T7 — Social impersonation

Social Write does not mean “send as artist” in this initiative. Before delegated Social publishing may ship, it requires a separate actor/audit design with draft, approval, published-by, and rollback semantics. Current Team Operations UI must label Social management Owner only rather than using existing post ownership checks incorrectly.

### T8 — Team-room identity or participant drift

| Threat | Mitigation |
|---|---|
| Member sends as managed artist | No managed-artist sender option; sender user/profile must belong to auth caller |
| Former member remains participant | Lifecycle sync plus repair RPC and drift health check |
| Message link leaks hidden source | Allowlisted snapshot; opening source reauthorizes; no service-role expansion |
| Group-policy recursion | Continue using SECURITY DEFINER participant helper; never self-query in participant RLS |
| Mention spams nonmembers | Mention resolver limited to active room participants |

### T9 — Team Brief leaks restricted sources

- Derived sections are composed under the caller's RLS.
- Pins show a generic unavailable state when source permission is absent.
- A pin never grants source access.
- Authored brief text is active-team-only.
- Brief seen state is visible only to the member who owns it.
- Links allow only HTTP(S); rendering uses safe link attributes and no metadata fetch.

### T10 — History becomes surveillance

Membership history records invitation, acceptance, role/access changes, suspension, leaving, and revocation. It does not record opens, time on page, message reads, task viewing, typing, presence, location, or inferred work hours. Team Brief seen state is not artist-readable.

### T11 — Starter kit becomes an access or content-injection path

| Threat | Mitigation |
|---|---|
| Selecting Manager grants broad artist access | Starter roles never enter authorization helpers; artist grants remain membership-scoped |
| Client submits arbitrary catalog payload | Installer loads active server catalog and validates closed item kinds; client sends keys/options only |
| Kit writes into an artist workspace | Transaction requires caller-owned `workspace_kind = 'personal'`; target adapters recheck every foreign key |
| Retrying creates duplicate tasks/templates | Caller/request idempotency plus stable semantic content keys |
| Kit update overwrites edited work | Updates are additive; fingerprints permit removal only for untouched private examples |
| Crafted saved-view filter leaks another artist | Closed filter schema; view stores filters only and authoritative queries still apply caller RLS |
| Catalog text carries script/URL injection | No HTML, SQL, URL, person-id, or executable payload fields; normal React escaping remains required |
| Role choices become admin profiling | No per-person admin view; telemetry uses kit/action enums and aggregate buckets only |

---

## 6. RLS policy plan by object

Exact SQL is written and reviewed with each migration. The required predicate shape is fixed here.

### `artist_members`

- Owner: read/manage rows for owned artist.
- Subject: read their own row, accept/decline/leave only through guarded RPC.
- Active teammates: may read allowlisted active-roster projection through a view/RPC, not raw rows containing grants/invite data.
- Suspended/revoked members: may read their own historical row and status, not the artist roster.

### `artist_membership_events`

- Artist owner: read events for owned artist.
- Subject: read events for their own membership.
- Delegated team administrator, if later shipped: read only events occurring while authorized, via reviewed helper.
- Insert: RPC/trigger only; no arbitrary browser insert.
- Update/delete: none.

### `tasks`

- Preserve owner policies.
- Member SELECT: `can_read_space_area(space_id, 'tasks')` or caller is the explicit assignee and the assignment-source contract permits narrow read.
- Member INSERT/UPDATE: `can_write_space_area(space_id, 'tasks')`.
- Assignee status update: narrow RPC, not broad UPDATE policy.
- Member DELETE: none initially.

### `task_assignment_events`

- Read follows task/artist permission; subject can see events for tasks currently readable.
- Insert only from assignment RPC/trigger.
- Update/delete none.

### `review_requests`

- Owner: full for owned artist.
- Area readers: SELECT only if underlying source is readable and the request belongs to artist.
- Area writers: create/reassign/cancel for matching source area.
- Assignee: select and complete through kind-specific RPC if source remains readable.
- Former member: no access after membership ends unless result appears independently through another authorized identity.

### Team Brief tables

- SELECT: owner or active team member.
- Authored mutations: owner only initially; later Team Write through constrained policies/RPC.
- Pins additionally validate source belongs to artist.
- Seen rows: `user_id = auth.uid()` only; no owner override.

### `artist_team_rooms`

- SELECT: owner or active member; conversation contents still use participant RLS.
- INSERT: `ensure_artist_team_room` only.
- Update/delete: none from browser.

### `message_work_links`

- Read: conversation participant plus current room/source authorization; snapshot itself contains no sensitive content.
- Insert: message sender and active room participant, target validated for same artist and readable source.
- Delete: message sender or room admin under existing message rules.

### `pro_availability`

- Owner CRUD only on table.
- Other teams read only through allowlisted function with active shared relationship and `share_with_teams = true`.

### `artist_member_preferences`

- `user_id = auth.uid()` for all actions.
- Artist owner has no read path.

### Starter-kit catalog

- Authenticated callers may preview only active versions through an allowlisted function.
- Browser roles cannot insert, update, or delete catalog/definition rows.
- Catalog mutations ship through reviewed additive migrations or a future separately secured internal publisher.

### `pro_home_preferences` and `pro_saved_views`

- `user_id = auth.uid()` for all actions.
- Saved-view surface, sort, and filter keys use closed validation; no stored query text.
- No artist owner, teammate, or platform-admin browser path may read another Pro's rows.

### `pro_starter_kit_installations` and `pro_starter_kit_items`

- Caller may read only their own receipts.
- Insert/status changes occur through guarded installer/restore/removal RPCs.
- Direct browser update/delete is denied.
- Target objects remain protected by their ordinary owner/RLS policies; provenance never grants target access.

---

## 7. Storage and attachment rules

- Team-room attachments continue through existing private message attachment authorization.
- Linking an audio/version work item does not attach or duplicate its file.
- Audio playback requires Audio Read/Write at signing time and current artist membership.
- Team Brief links are external HTTP(S) URLs only; uploaded brand files remain existing artist assets and require existing storage paths/permissions.
- No Team Operations table stores signed URLs.
- Revocation does not delete messages or files authored/uploaded while authorized. Ownership and deletion rules remain source-specific.

---

## 8. Notification privacy

Allowed notification fields:

- Artist display name/emblem path when recipient may see artist
- Work type and short source title when recipient may read source
- Actor display name
- Due/change state
- Safe deep link and stable group key

If source access disappears before notification fetch, the notification serializer returns a generic “Team access changed” or “This item is no longer available” state. It never uses a service-role read to preserve old creative titles.

Room message previews follow current messaging participant checks. Muted room notifications never suppress security-sensitive membership changes.

---

## 9. Admin privacy boundary

Platform admins may see operational health counts:

- Team Operations migration/feature-gate state
- Counts of pending/active/suspended memberships
- Counts of failed lifecycle/notification deliveries
- Aggregate assignment/review adoption events using the existing privacy-safe product-event registry

Admins must not receive:

- Team Brief text or links
- Task/review titles or notes
- Team-room messages or attachments
- Per-Pro cross-artist schedules/workload
- Exact artist access grants unless needed for a user-submitted support case and explicitly authorized by a future support tool
- Availability notes
- Per-person starter-kit role selections, previews, saved views, layouts, or installed item lists

Audit events remain enums/buckets and never include creative strings.

---

## 10. Required adversarial test accounts

Use an isolated non-production project with:

- **A:** Artist Alpha owner
- **B:** Artist Beta owner
- **P:** Pro active on both artists with different grants
- **M:** Pro active on Alpha only
- **S:** Suspended former Alpha member
- **C:** Track collaborator on one Alpha track, not team member
- **U:** Authenticated unrelated user
- **G:** Unauthenticated guest review link user
- **Admin:** Platform administrator without artist membership

Critical assertions:

1. Alpha cannot query P's Beta work, dates, membership, room, or preferences.
2. P can query only sources allowed by each artist's different grants.
3. M cannot query Beta by UUID guessing.
4. S loses direct Supabase reads and team-room topic authorization immediately.
5. C gains no Team Brief, team room, roster, or My Work artist access.
6. U gains nothing through guessed ids.
7. G remains limited to existing review token allowlist.
8. Admin does not gain creative Team Operations data through normal authenticated queries.
9. Assignment to U, C, S, or a member without required area is rejected.
10. Offboarding cannot reassign Alpha work to a Beta-only person.
11. P can install a starter kit only into P's personal workspace; supplying Alpha/Beta workspace ids is rejected.
12. Repeating a starter-kit request id produces no duplicate target rows, and a forged catalog payload/key is rejected.
13. Alpha, Beta, M, S, U, and Admin cannot read P's starter selections, views, installation rows, or private sample work.

---

## 11. Release-blocking security checklist

- [ ] Every new table has RLS enabled before exposure.
- [ ] No permissive `USING (true)` policy.
- [ ] All helper functions revoke `public`/`anon` execution where appropriate.
- [ ] Direct PostgREST/Supabase queries—not only UI tests—prove denies.
- [ ] Active/suspended/revoked transitions are tested in the same session and after reconnect.
- [ ] Assignment does not widen source access.
- [ ] Cross-artist My Work/schedule cannot be called for another user.
- [ ] Team-room topic authorization updates on lifecycle change.
- [ ] Link/brief/message snapshots contain no paths, filenames, notes, or hidden identifiers beyond safe target ids.
- [ ] Existing owner, track collaborator, guest review, and admin privacy tests remain green.
- [ ] Starter-kit preview/install accepts closed options only, writes personal-workspace targets only, and is idempotent under concurrent retry.
- [ ] Edited starter examples survive restore/removal; untouched examples can be removed without touching unrelated user content.
- [ ] No production data is used for automated/adversarial testing.
