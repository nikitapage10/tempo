-- TEMPO migration 095 — make the platform member role visible to the app
-- Additive. Run after 094. Drops nothing, truncates nothing, and weakens no
-- existing policy.
--
-- Until now "is this person a team member?" was derived entirely from
-- artist_members — i.e. from an *artist* having invited them. Someone the
-- admin invites directly as a team member has no such row, so every
-- derivation downstream (workspace kind, rail, the Origin gate) mistook them
-- for a solo artist and dropped them into artist onboarding.
--
-- Both routes into a team are now equal (see lib/auth/passage-gate.ts), so
-- the platform role has to be readable alongside the membership table.
--
-- The durable answer already exists in member_onboarding.member_role; it was
-- simply unreachable from the browser. This exposes it read-only.

-- ---------- Own-row read access ----------

-- 056 deliberately shipped member_onboarding with no browser-facing policies,
-- routing every read through /api/onboarding. That still holds for writes:
-- this adds SELECT on the caller's own row only, which returns exactly what
-- that endpoint already hands back to the same person. Nothing else is
-- readable, and nothing becomes writable.
drop policy if exists own_member_onboarding_read on member_onboarding;
create policy own_member_onboarding_read on member_onboarding for select
  using (user_id = auth.uid());

-- ---------- Passage gained a look step ----------

-- Restated here rather than only in 094 so the change lands whether or not
-- that migration was already applied when the step was added.
do $$
begin
  if exists (select 1 from pg_tables where tablename = 'member_passages') then
    alter table member_passages drop constraint if exists member_passages_current_step_check;
    alter table member_passages add constraint member_passages_current_step_check
      check (current_step in (
        'role', 'entry', 'support', 'function', 'look', 'story', 'complete'
      ));
  end if;
end $$;

-- ---------- Repair: team members mis-seeded as music artists ----------

-- A team member who signed in before this fix was given a music artist row
-- (workspace_kind 'artist'), which is what put Tracks and Board in their rail
-- and sent them through Origin. Convert those to the personal home they
-- should always have had.
--
-- Deliberately narrow: only a member_onboarding team_member, only when the
-- single artist row they own carries no catalog. Anyone who actually made
-- music under that row is left completely alone.
update artists a
set workspace_kind = 'personal',
    origin_status = 'legacy_complete',
    origin_completed_at = coalesce(a.origin_completed_at, now())
where coalesce(a.workspace_kind, 'artist') = 'artist'
  and exists (
    select 1 from member_onboarding mo
    where mo.user_id = a.user_id and mo.member_role = 'team_member'
  )
  and (select count(*) from artists o where o.user_id = a.user_id) = 1
  and not exists (select 1 from tracks t where t.artist_id = a.id);
