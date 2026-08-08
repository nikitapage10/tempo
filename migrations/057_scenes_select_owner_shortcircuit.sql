-- TEMPO migration 057 — repair: a scene could never be created through the app
--
-- Root cause (found by diffing a working SQL-editor insert against the app's
-- actual request payload — the two were byte-for-byte identical, so the data
-- was never the problem):
--
--   PostgREST issues `INSERT ... RETURNING` (that's what `?select=*` means).
--   Postgres applies the table's SELECT policy to the row being returned.
--   049's select_scenes policy is `using (can_view_scene(id))`, and
--   can_view_scene() is defined as `select exists (select 1 from scenes s
--   where s.id = p_scene_id and ...)` — it looks the scene up *in the scenes
--   table*. During the INSERT that created it, that row is not yet visible to
--   a subquery inside a function called from the same statement, so the
--   lookup finds nothing, can_view_scene() returns false, and the insert is
--   rejected with a bare 42501.
--
--   This is why the failure was invisible to every direct-SQL test: a plain
--   `insert into scenes (...) values (...)` has no RETURNING clause, so the
--   SELECT policy is never evaluated and the insert succeeds. Only the
--   RETURNING path — i.e. only the app — could ever hit it.
--
-- Fix: short-circuit on ownership before consulting can_view_scene(). The
-- owner check reads the candidate row's own column directly rather than
-- re-querying the table, so it evaluates correctly even mid-INSERT. It is
-- also just correct on its own terms: the owner of a scene should always be
-- able to see it, including an unlisted one, without a membership lookup.
--
-- can_view_scene() itself is deliberately left alone. Every other caller
-- (posts, polls, events, topics, chat) asks about an already-committed scene,
-- where it behaves correctly, and it is the single definition of scene
-- visibility for those tables. Narrowing the repair to this one policy keeps
-- the blast radius to the statement that was actually broken.

drop policy if exists select_scenes on scenes;
create policy select_scenes on scenes for select
  to authenticated
  using (
    -- Direct column read: safe during INSERT ... RETURNING, unlike a
    -- function that re-queries `scenes` for a row that isn't visible yet.
    owner_user_id = auth.uid()
    or can_view_scene(id)
  );
