-- TEMPO migration 074 — starter-community provisioning marker (performance)
-- Additive only. Drops nothing, truncates nothing, weakens no existing policy.
--
-- /api/onboarding runs on every authenticated page load. Until now every one
-- of those calls re-ran provisionStarterCommunity(), which issues ~25
-- sequential round trips (starter profiles, follows, seed posts, the Green
-- Room scene, memberships, chat) before returning. Every write in there is
-- idempotent, so the repeat work was harmless — but it was measured at ~700ms
-- on each page load, for accounts that were fully provisioned months ago.
--
-- This column records that the first-run provisioning finished, so the
-- endpoint can skip straight to reading the row. It is deliberately a
-- timestamp rather than a boolean: knowing *when* an account was provisioned
-- is useful when diagnosing a first-run that went wrong.

alter table member_onboarding
  add column if not exists starter_community_provisioned_at timestamptz;

-- Backfill accounts that demonstrably completed provisioning already, so
-- existing members get the fast path immediately rather than paying for one
-- more slow call each.
--
-- The evidence used is the last thing provisionStarterCommunity() does:
-- join the member to the starter Scene. Anything short of that stays NULL and
-- is simply re-attempted on the next request, exactly as it is today — so an
-- account can only ever be under-stamped here, never wrongly marked done.
--
-- 'tempo-green-room' is the default starter slug. A deployment that overrides
-- ONBOARDING_DEMO_SCENE_SLUG just won't match here; those accounts take the
-- slow path once more and the application stamps them itself. Self-healing
-- either way.
update member_onboarding mo
set starter_community_provisioned_at = now()
where mo.starter_community_provisioned_at is null
  and exists (
    select 1
    from scene_members sm
    join scenes s on s.id = sm.scene_id
    where sm.user_id = mo.user_id
      and sm.status = 'active'
      and s.slug = 'tempo-green-room'
      and s.archived_at is null
  );

insert into schema_migrations (version, name, checksum, applied_by)
values (74, '074_starter_community_provisioned_marker', 'initial', 'migration-self-register')
on conflict (version) do nothing;
