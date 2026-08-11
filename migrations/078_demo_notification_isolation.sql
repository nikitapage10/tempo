-- TEMPO migration 078: make demo notification isolation authoritative.
--
-- Demo workspaces must never act as people. This guard lives at the common
-- notification boundary so it covers follows and every future social action,
-- even if an application path accidentally attempts one from a demo profile.

create or replace function reject_demo_actor_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.actor_profile_id is not null and exists (
    select 1
    from artist_profiles profile
    join artists artist on artist.id = profile.artist_id
    where profile.id = new.actor_profile_id
      and artist.demo_kind is not null
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reject_demo_actor_notification on notifications;
create trigger trg_reject_demo_actor_notification
  before insert on notifications
  for each row execute function reject_demo_actor_notification();

-- Keep the sanctioned cross-account helper safe independently of trigger
-- ordering and of direct maintenance calls.
create or replace function notify_profile_owner(
  p_target_profile_id uuid,
  p_actor_profile_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_link_url text default null,
  p_group_key text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  if p_actor_profile_id is not null and exists (
    select 1
    from artist_profiles profile
    join artists artist on artist.id = profile.artist_id
    where profile.id = p_actor_profile_id
      and artist.demo_kind is not null
  ) then
    return;
  end if;

  select owner_user_id into v_user
  from artist_profiles
  where id = p_target_profile_id;
  if v_user is null then return; end if;
  if v_user = auth.uid() then return; end if;

  insert into notifications (
    user_id, type, title, body, actor_profile_id, target_profile_id,
    entity_type, entity_id, link_url, group_key
  ) values (
    v_user, p_type, p_title, p_body, p_actor_profile_id, p_target_profile_id,
    p_entity_type, p_entity_id, p_link_url, p_group_key
  );
end;
$$;

revoke execute on function notify_profile_owner(uuid, uuid, text, text, text, text, uuid, text, text)
  from public, anon, authenticated;

-- Remove live demo actors while their profile relationship still exists.
delete from notifications notification
using artist_profiles profile, artists artist
where notification.actor_profile_id = profile.id
  and profile.artist_id = artist.id
  and artist.demo_kind is not null;

-- Earlier demo deletions set actor_profile_id to null. The repair in migration
-- 076 also emitted PRESIDENT notifications before a later cleanup removed the
-- copied follow. Delete only PRESIDENT notices that have no live matching
-- follow, preserving a legitimate notification from the real showcase account.
delete from notifications notification
where notification.type = 'profile_follow'
  and notification.title = 'PRESIDENT followed you'
  and not exists (
    select 1
    from profile_follows follow
    where follow.follower_profile_id = notification.actor_profile_id
      and follow.followee_profile_id = notification.target_profile_id
  );

insert into schema_migrations (version, name, checksum, applied_by)
values (78, '078_demo_notification_isolation', 'initial', 'migration-self-register')
on conflict (version) do nothing;
