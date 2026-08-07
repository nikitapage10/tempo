-- TEMPO migration 050 — Scenes, part 2: the forum feed
-- Additive columns on `posts` + a rewrite of four 030 objects.
-- Depends on 049. RUN 049 FIRST — the foreign keys below will fail otherwise.
--
-- This is the only migration in the Scenes set that touches something already
-- shipped, so it is written to be reviewable as a diff rather than as logic:
--
--   Every rewritten predicate is BIFURCATED on `scene_id is null`, and the
--   existing 030 expression is reproduced VERBATIM inside the null branch.
--   Reviewing this file is therefore two questions:
--     1. Did the old text survive character-for-character in the null branch?
--     2. Is every new clause gated behind `scene_id is not null`?
--   Any row that exists today has scene_id = null, so its visibility is
--   provably unchanged.
--
-- Why extend `posts` rather than add `scene_posts`: a second table would mean
-- duplicating post_likes, post_comments, post_mentions, both counter triggers,
-- all three notify triggers, the attachment_snapshot freeze, a second
-- content_reports target, and a parallel component tree — kept in sync
-- forever. Extending costs exactly this one file. The payoff is that
-- likePost/fetchPostComments/FeedPostCard work on scene posts unchanged.

-- ---------- columns ----------

alter table posts
  add column if not exists scene_id uuid references scenes(id) on delete cascade,
  add column if not exists scene_topic_id uuid references scene_topics(id) on delete set null,
  add column if not exists kind text not null default 'post',
  add column if not exists pinned_at timestamptz;

do $$
begin
  -- Additive constraints only. The existing posts_visibility check is NOT
  -- widened or dropped: scene posts carry visibility='members' as a formality
  -- and scene membership is the real gate, so the shipped enum keeps meaning
  -- exactly what it meant.
  if not exists (select 1 from pg_constraint where conname = 'posts_kind_shape') then
    alter table posts add constraint posts_kind_shape
      check (kind in ('post', 'poll', 'question', 'announcement'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'posts_scene_visibility') then
    alter table posts add constraint posts_scene_visibility
      check (scene_id is null or visibility = 'members');
  end if;
  -- A topic without a scene is meaningless; a non-'post' kind outside a scene
  -- would leak poll/announcement chrome into the home timeline.
  if not exists (select 1 from pg_constraint where conname = 'posts_scene_shape') then
    alter table posts add constraint posts_scene_shape
      check (scene_id is not null or (scene_topic_id is null and kind = 'post'));
  end if;
end $$;

create index if not exists idx_posts_scene_created
  on posts (scene_id, created_at desc)
  where deleted_at is null and scene_id is not null;
create index if not exists idx_posts_scene_topic_created
  on posts (scene_topic_id, created_at desc)
  where deleted_at is null and scene_topic_id is not null;
create index if not exists idx_posts_scene_pinned
  on posts (scene_id, pinned_at desc)
  where pinned_at is not null and deleted_at is null;

-- ---------- rewrite 1 of 4: home_timeline ----------
-- Done FIRST, and deliberately: one added line (`and p.scene_id is null`)
-- means that even if the select_posts rewrite below were botched, a scene
-- post still cannot reach anybody's home feed. This is the single most
-- important line in the file.

create or replace function home_timeline(p_limit int default 30, p_before timestamptz default null)
returns setof posts
language sql stable security invoker set search_path = public as $$
  select p.*
  from posts p
  where p.deleted_at is null
    and p.scene_id is null            -- ADDED IN 050: scene posts never fan out here
    and (p_before is null or p.created_at < p_before)
    and (
      p.author_user_id = auth.uid()
      or p.author_profile_id in (
        select f.followee_profile_id
        from profile_follows f
        where f.follower_profile_id in (select my_profile_ids())
      )
    )
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke execute on function home_timeline(int, timestamptz) from public, anon;
grant execute on function home_timeline(int, timestamptz) to authenticated;

-- ---------- rewrite 2 of 4: can_view_post ----------
-- post_likes, post_comments and post_mentions all route their policies
-- through this helper, so bifurcating here is what gives scene posts working
-- likes and comments WITHOUT touching a single child-table policy.

create or replace function can_view_post(p_post_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from posts p
    where p.id = p_post_id
      and p.deleted_at is null
      and (
        -- ===== scene branch (new in 050) =====
        (p.scene_id is not null and can_view_scene(p.scene_id))
        -- ===== non-scene branch: 030 text, unchanged =====
        or (p.scene_id is null and (
          p.author_user_id = auth.uid()
          or (
            exists (
              select 1 from artist_profiles ap
              where ap.id = p.author_profile_id
                and ap.visibility in ('members', 'public')
            )
            and (
              p.visibility in ('members', 'public')
              or (
                p.visibility = 'followers'
                and exists (
                  select 1 from profile_follows f
                  where f.followee_profile_id = p.author_profile_id
                    and f.follower_profile_id in (select my_profile_ids())
                )
              )
            )
            and not is_blocked_between(
              p.author_profile_id,
              (select id from artist_profiles where owner_user_id = auth.uid() limit 1)
            )
          )
        ))
      )
  );
$$;

revoke execute on function can_view_post(uuid) from public, anon;
grant execute on function can_view_post(uuid) to authenticated;

-- ---------- rewrite 3 of 4: select_posts ----------

drop policy if exists select_posts on posts;
create policy select_posts on posts for select
  to authenticated
  using (
    deleted_at is null
    and (
      -- ===== scene branch (new in 050) =====
      -- Membership is the whole gate. A non-member selecting by scene_id
      -- gets zero rows; there is no follower/visibility path in.
      (scene_id is not null and can_view_scene(scene_id))
      -- ===== non-scene branch: 030 text, unchanged =====
      or (scene_id is null and (
        author_user_id = auth.uid()
        or (
          exists (
            select 1 from artist_profiles ap
            where ap.id = author_profile_id
              and ap.visibility in ('members', 'public')
          )
          and (
            visibility in ('members', 'public')
            or (
              visibility = 'followers'
              and exists (
                select 1 from profile_follows f
                where f.followee_profile_id = author_profile_id
                  and f.follower_profile_id in (select my_profile_ids())
              )
            )
          )
          and not is_blocked_between(
            author_profile_id,
            (select id from artist_profiles where owner_user_id = auth.uid() limit 1)
          )
        )
      ))
    )
  );

-- ---------- rewrite 4 of 4: insert_posts ----------
-- The 030 clauses are untouched, including is_track_owner — you can still
-- only ever attach your OWN track, in a scene exactly as in the home feed.

drop policy if exists insert_posts on posts;
create policy insert_posts on posts for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
    and owns_profile(author_profile_id)
    and (track_id is null or is_track_owner(track_id))
    and (scene_id is null or can_post_in_scene(scene_id, author_profile_id, scene_topic_id))
  );

-- update_posts and delete_posts are NOT touched. Moderator removal is a
-- definer RPC below rather than a widened policy, so "who may edit this row"
-- stays exactly "its author" for every post in the product.

-- ---------- scene feed ----------
-- security invoker, mirroring home_timeline, so posts' own RLS still applies
-- as defense in depth even though can_view_scene already gated the caller.
-- Pinned posts are returned by a separate call, not merged here, so keyset
-- pagination stays a clean single-column cursor.

create or replace function scene_feed(
  p_scene_id uuid,
  p_topic_id uuid default null,
  p_limit int default 30,
  p_before timestamptz default null
) returns setof posts
language sql stable security invoker set search_path = public as $$
  select p.*
  from posts p
  where p.scene_id = p_scene_id
    and p.deleted_at is null
    and p.pinned_at is null
    and (p_topic_id is null or p.scene_topic_id = p_topic_id)
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke execute on function scene_feed(uuid, uuid, int, timestamptz) from public, anon;
grant execute on function scene_feed(uuid, uuid, int, timestamptz) to authenticated;

-- ---------- moderation actions ----------
-- Migration 054 replaces scene_remove_post with a version that also writes a
-- scene_moderation_log row. That replacement is not a no-op — the same way
-- 029 replaces 028's profile_is_readable.

create or replace function scene_remove_post(p_post_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_scene uuid;
begin
  select scene_id into v_scene from posts where id = p_post_id;
  if v_scene is null then
    raise exception 'That post is not in a scene' using errcode = '42501';
  end if;
  if not is_scene_manager(v_scene) then
    raise exception 'Only a scene owner or moderator can remove a post' using errcode = '42501';
  end if;
  update posts set deleted_at = now() where id = p_post_id and deleted_at is null;
end;
$$;

create or replace function set_scene_post_pinned(p_post_id uuid, p_pinned boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_scene uuid;
begin
  select scene_id into v_scene from posts where id = p_post_id;
  if v_scene is null then
    raise exception 'That post is not in a scene' using errcode = '42501';
  end if;
  if not is_scene_manager(v_scene) then
    raise exception 'Only a scene owner or moderator can pin a post' using errcode = '42501';
  end if;
  update posts set pinned_at = case when p_pinned then now() else null end
  where id = p_post_id;
end;
$$;

revoke execute on function scene_remove_post(uuid, text) from public, anon;
revoke execute on function set_scene_post_pinned(uuid, boolean) from public, anon;
grant execute on function scene_remove_post(uuid, text) to authenticated;
grant execute on function set_scene_post_pinned(uuid, boolean) to authenticated;

-- ---------- counters ----------
-- security definer: the poster does not own the scene row, so a plain
-- trigger's UPDATE would be filtered to zero rows by update_scenes.

create or replace function bump_scene_post_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_scene uuid := coalesce(new.scene_id, old.scene_id);
  v_was boolean := (tg_op <> 'INSERT' and old.scene_id is not null and old.deleted_at is null);
  v_now boolean := (tg_op <> 'DELETE' and new.scene_id is not null and new.deleted_at is null);
begin
  if v_scene is null then return coalesce(new, old); end if;

  if v_was <> v_now then
    update scenes
    set post_count = greatest(post_count + case when v_now then 1 else -1 end, 0),
        last_activity_at = case when v_now then now() else last_activity_at end
    where id = v_scene;
  elsif v_now then
    update scenes set last_activity_at = now() where id = v_scene;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_bump_scene_post_count on posts;
create trigger trg_bump_scene_post_count
  after insert or update of deleted_at or delete on posts
  for each row execute function bump_scene_post_count();

-- ---------- notifications ----------
-- Announcements ONLY. An ordinary post writes zero notification rows: a
-- 200-member scene posting 30 times a day would otherwise put 6,000 rows a
-- day into the shared tray and bury every catalog notification in it. The
-- member-facing signal for ordinary activity is an unread dot derived from
-- scene_members.last_read_at vs scenes.last_activity_at.
--
-- @mentions inside a scene post still notify, because post_mentions'
-- notify_on_mention trigger from 030 fires unchanged.

create or replace function notify_on_scene_announcement() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_scene text;
  v_slug text;
  v_name text;
begin
  if new.scene_id is null or new.kind <> 'announcement' then return new; end if;

  select name, slug into v_scene, v_slug from scenes where id = new.scene_id;
  select display_name into v_name from artist_profiles where id = new.author_profile_id;

  for r in
    select m.profile_id from scene_members m
    where m.scene_id = new.scene_id
      and m.status = 'active'
      and not m.muted
      and m.profile_id <> new.author_profile_id
  loop
    perform notify_profile_owner(
      r.profile_id, new.author_profile_id, 'scene_announcement',
      coalesce(v_scene, 'A scene') || ' posted an announcement',
      left(new.body, 140), 'scene', new.scene_id,
      '/scenes/' || v_slug || '?post=' || new.id::text,
      'scene_announcement:' || new.id::text
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_scene_announcement on posts;
create trigger trg_notify_on_scene_announcement after insert on posts
  for each row execute function notify_on_scene_announcement();
