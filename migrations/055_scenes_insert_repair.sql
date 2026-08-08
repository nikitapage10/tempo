-- TEMPO migration 055 — repair: scenes could not be created
--
-- Symptom observed live: creating a scene failed with
--   {"code":"42501","message":"new row violates row-level security policy
--    for table \"scenes\""}
-- even though the caller owned the profile being used (owns_profile()
-- returns true via direct RPC) and owner_user_id matched auth.uid().
-- update_scenes, select on scenes/scene_members/scene_topics, and the
-- seed_new_scene() trigger were all confirmed working — only insert_scenes
-- was affected, which points at that one policy statement not having taken
-- effect when 049 was first applied, not a broader schema problem.
--
-- This just re-issues 049's own RLS policies and the member-count trigger,
-- verbatim, using the same idempotent drop-if-exists-then-create shape those
-- statements already had. Safe to run whether or not the earlier run
-- actually left them missing — a policy identical to the existing one is a
-- no-op.

drop policy if exists insert_scenes on scenes;
create policy insert_scenes on scenes for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    and owns_profile(owner_profile_id)
  );

drop policy if exists select_scenes on scenes;
create policy select_scenes on scenes for select
  to authenticated
  using (can_view_scene(id));

drop policy if exists update_scenes on scenes;
create policy update_scenes on scenes for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists delete_scenes on scenes;
create policy delete_scenes on scenes for delete
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists select_scene_members on scene_members;
create policy select_scene_members on scene_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or is_scene_member(scene_id)
    or is_scene_manager(scene_id)
  );

drop policy if exists insert_scene_members on scene_members;
create policy insert_scene_members on scene_members for insert
  to authenticated
  with check (false);

drop policy if exists update_scene_members on scene_members;
create policy update_scene_members on scene_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists select_scene_topics on scene_topics;
create policy select_scene_topics on scene_topics for select
  to authenticated
  using (can_view_scene(scene_id));

drop policy if exists insert_scene_topics on scene_topics;
create policy insert_scene_topics on scene_topics for insert
  to authenticated
  with check (is_scene_manager(scene_id));

drop policy if exists update_scene_topics on scene_topics;
create policy update_scene_topics on scene_topics for update
  to authenticated
  using (is_scene_manager(scene_id))
  with check (is_scene_manager(scene_id));

drop policy if exists delete_scene_topics on scene_topics;
create policy delete_scene_topics on scene_topics for delete
  to authenticated
  using (is_scene_manager(scene_id));

-- Re-assert the member-count trigger too — observed as briefly stale (0
-- right after insert, correct moments later), consistent with connection-
-- pooler read timing rather than a real bug, but cheap to reassert alongside
-- the policies above since this file is already re-running 049's DDL.
drop trigger if exists trg_bump_scene_member_count on scene_members;
create trigger trg_bump_scene_member_count
  after insert or update of status or delete on scene_members
  for each row execute function bump_scene_member_count();
