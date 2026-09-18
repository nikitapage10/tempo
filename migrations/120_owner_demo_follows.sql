-- TEMPO migration 120: let a member follow their own demo artist.
--
-- Migration 076 blocked every follow that touched a demo profile. That kept
-- PRESIDENT out of strangers' graphs, which stays correct. It also made it
-- impossible for the person who owns the demo to follow it from their real
-- artist — so the demo profile never showed up under Social → Follows even
-- though they can already open it as the owner.
--
-- The rule is now: a demo may only follow, or be followed by, another profile
-- owned by the same account. Cross-account demo follows stay rejected.
-- Same-account follows also skip the follow notification, so seeding does not
-- ping you that "PRESIDENT followed you."

create or replace function reject_demo_profile_follow() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_follower_owner uuid;
  v_followee_owner uuid;
  v_follower_demo boolean;
  v_followee_demo boolean;
begin
  select p.owner_user_id, (a.demo_kind is not null)
    into v_follower_owner, v_follower_demo
  from artist_profiles p
  join artists a on a.id = p.artist_id
  where p.id = new.follower_profile_id;

  select p.owner_user_id, (a.demo_kind is not null)
    into v_followee_owner, v_followee_demo
  from artist_profiles p
  join artists a on a.id = p.artist_id
  where p.id = new.followee_profile_id;

  -- Either side missing means the row is malformed; refuse it.
  if v_follower_owner is null or v_followee_owner is null then
    return null;
  end if;

  -- At least one side is a demo, and the owners differ: keep the old wall.
  if (coalesce(v_follower_demo, false) or coalesce(v_followee_demo, false))
     and v_follower_owner is distinct from v_followee_owner then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reject_demo_profile_follow on profile_follows;
create trigger trg_reject_demo_profile_follow
  before insert on profile_follows
  for each row execute function reject_demo_profile_follow();

-- Same-account demo follows are scaffolding for the owner, not social news.
create or replace function notify_on_follow() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor_name text;
  v_handle text;
  v_is_demo boolean;
  v_follower_owner uuid;
  v_followee_owner uuid;
begin
  select p.display_name, p.handle, (a.demo_kind is not null), p.owner_user_id
    into v_actor_name, v_handle, v_is_demo, v_follower_owner
  from artist_profiles p
  join artists a on a.id = p.artist_id
  where p.id = new.follower_profile_id;

  if coalesce(v_is_demo, false) then return new; end if;

  select p.owner_user_id into v_followee_owner
  from artist_profiles p
  where p.id = new.followee_profile_id;

  if v_follower_owner is not null
     and v_followee_owner is not null
     and v_follower_owner = v_followee_owner then
    return new;
  end if;

  perform notify_profile_owner(
    new.followee_profile_id,
    new.follower_profile_id,
    'profile_follow',
    coalesce(v_actor_name, 'Someone') || ' followed you',
    null,
    'profile',
    new.follower_profile_id,
    case when v_handle is not null then '/artist/' || v_handle else null end,
    'follow:' || new.follower_profile_id::text
  );
  return new;
end;
$$;

-- Backfill: every account that already has a demo gets mutual follows with
-- each of its real (non-demo) artist profiles. Idempotent via ON CONFLICT.
insert into profile_follows (follower_profile_id, followee_profile_id)
select real_profile.id, demo_profile.id
from artist_profiles demo_profile
join artists demo_artist on demo_artist.id = demo_profile.artist_id
join artist_profiles real_profile
  on real_profile.owner_user_id = demo_profile.owner_user_id
join artists real_artist on real_artist.id = real_profile.artist_id
where demo_artist.demo_kind is not null
  and real_artist.demo_kind is null
  and real_profile.id <> demo_profile.id
on conflict do nothing;

insert into profile_follows (follower_profile_id, followee_profile_id)
select demo_profile.id, real_profile.id
from artist_profiles demo_profile
join artists demo_artist on demo_artist.id = demo_profile.artist_id
join artist_profiles real_profile
  on real_profile.owner_user_id = demo_profile.owner_user_id
join artists real_artist on real_artist.id = real_profile.artist_id
where demo_artist.demo_kind is not null
  and real_artist.demo_kind is null
  and real_profile.id <> demo_profile.id
on conflict do nothing;

insert into schema_migrations (version, name, checksum, applied_by)
values (120, '120_owner_demo_follows', 'initial', 'migration-self-register')
on conflict (version) do nothing;
