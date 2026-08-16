-- TEMPO migration 100: preserve an artist when they later become a Pro.
-- Additive and rerunnable. Run after 099.
--
-- An established artist can accept a team or platform-Pro invitation on the
-- same auth account. Their artist workspace and new personal Pro home are two
-- identities under one login. Earlier client classification forgot that
-- `legacy_complete` is a finished artist status, so some pre-invite artist rows
-- were relabelled `personal`. Restore only rows that provably predate the first
-- Pro/team acceptance, then add a separate personal home when one is missing.

with pro_arrivals as (
  select user_id, min(arrived_at) as arrived_at
  from (
    select
      m.user_id,
      coalesce(m.accepted_at, m.created_at) as arrived_at
    from artist_members m
    where m.user_id is not null
      and m.status = 'active'

    union all

    select
      r.user_id,
      r.redeemed_at as arrived_at
    from invite_redemptions r
    join invites i on i.id = r.invite_id
    where i.member_role = 'team_member'
  ) arrivals
  group by user_id
), candidates as (
  select distinct on (a.user_id)
    a.id,
    a.user_id
  from artists a
  join pro_arrivals p on p.user_id = a.user_id
  where a.workspace_kind = 'personal'
    and a.demo_kind is null
    and a.created_at < p.arrived_at
    and not exists (
      select 1
      from artists music
      where music.user_id = a.user_id
        and music.workspace_kind = 'artist'
        and music.demo_kind is null
    )
  order by a.user_id, a.created_at asc
), restored as (
  update artists a
  set workspace_kind = 'artist'
  from candidates candidate
  where a.id = candidate.id
  returning a.user_id
), restored_users as (
  select distinct user_id from restored
)
insert into artists (
  user_id,
  name,
  workspace_kind,
  origin_status,
  origin_completed_at,
  sort
)
select
  restored_users.user_id,
  left(coalesce(nullif(trim(profile.display_name), ''), 'Home'), 60),
  'personal',
  'legacy_complete',
  now(),
  coalesce((
    select max(existing.sort) + 1
    from artists existing
    where existing.user_id = restored_users.user_id
  ), 0)
from restored_users
left join artist_member_profiles profile
  on profile.user_id = restored_users.user_id
where not exists (
  select 1
  from artists home
  where home.user_id = restored_users.user_id
    and home.workspace_kind = 'personal'
    and home.demo_kind is null
);

insert into schema_migrations (version, name, checksum, applied_by)
values (100, '100_dual_artist_pro_identities', 'initial', 'migration-self-register')
on conflict (version) do nothing;
