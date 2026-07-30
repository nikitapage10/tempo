-- TEMPO migration 030 — social feed (posts, likes, comments, mentions)
-- Additive only. Does not alter policies on pre-028 tables.
-- Depends on 028 (artist_profiles kernel) and 029 (profile_follows).

-- ========== posts ==========

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_profile_id uuid not null references artist_profiles(id) on delete cascade,
  -- Denormalized for ownership checks without joining artist_profiles under RLS.
  author_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null default '',
  media jsonb not null default '[]'::jsonb,
  track_id uuid references tracks(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  -- Frozen display fields for an attached track — renderer never joins tracks.
  attachment_snapshot jsonb,
  visibility text not null default 'followers'
    check (visibility in ('followers', 'members', 'public')),
  reply_to_post_id uuid references posts(id) on delete set null,
  like_count int not null default 0,
  comment_count int not null default 0,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_body_len check (char_length(body) <= 5000),
  constraint posts_media_len check (jsonb_array_length(media) <= 4),
  constraint posts_body_or_media check (
    deleted_at is not null
    or char_length(trim(body)) > 0
    or jsonb_array_length(media) > 0
    or track_id is not null
  )
);

create index if not exists idx_posts_author_created
  on posts (author_profile_id, created_at desc) where deleted_at is null;
create index if not exists idx_posts_visibility_created
  on posts (visibility, created_at desc) where deleted_at is null;
create index if not exists idx_posts_created
  on posts (created_at desc) where deleted_at is null;

drop trigger if exists trg_posts_updated_at on posts;
create or replace function touch_posts_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger trg_posts_updated_at before update on posts
  for each row execute function touch_posts_updated_at();

-- Freeze track display fields at insert time so viewers never need tracks RLS.
create or replace function freeze_post_attachment_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_artwork text;
  v_artist text;
begin
  if new.track_id is null then
    new.attachment_snapshot := null;
    return new;
  end if;
  select t.title, t.artwork_url into v_title, v_artwork
  from tracks t where t.id = new.track_id;
  select a.name into v_artist
  from tracks t
  join spaces s on s.id = t.space_id
  join artists a on a.id = s.artist_id
  where t.id = new.track_id;
  new.attachment_snapshot := jsonb_build_object(
    'track_id', new.track_id,
    'title', coalesce(v_title, 'Untitled'),
    'artwork_url', v_artwork,
    'artist_name', v_artist
  );
  return new;
end;
$$;

drop trigger if exists trg_freeze_post_attachment on posts;
create trigger trg_freeze_post_attachment
  before insert or update of track_id on posts
  for each row execute function freeze_post_attachment_snapshot();

-- ========== post_likes ==========

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  profile_id uuid not null references artist_profiles(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create index if not exists idx_post_likes_profile on post_likes (profile_id, created_at desc);

-- ========== post_comments ==========

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_profile_id uuid not null references artist_profiles(id) on delete cascade,
  author_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_comment_id uuid references post_comments(id) on delete cascade,
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_comments_body_len check (char_length(body) <= 2000),
  constraint post_comments_body_nonempty check (char_length(trim(body)) > 0)
);

create index if not exists idx_post_comments_post
  on post_comments (post_id, created_at) where deleted_at is null;

-- ========== post_mentions ==========

create table if not exists post_mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  comment_id uuid references post_comments(id) on delete cascade,
  mentioned_profile_id uuid not null references artist_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint post_mentions_one_parent check (
    (post_id is not null and comment_id is null)
    or (post_id is null and comment_id is not null)
  )
);

create index if not exists idx_post_mentions_profile
  on post_mentions (mentioned_profile_id, created_at desc);

-- ========== can_view_post (for child tables) ==========
-- Child tables go through this helper instead of inlining posts-SELECT logic,
-- which would nest posts-RLS → profile-RLS → follow-RLS per candidate row.

create or replace function can_view_post(p_post_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from posts p
    where p.id = p_post_id
      and p.deleted_at is null
      and (
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
      )
  );
$$;

revoke execute on function can_view_post(uuid) from public, anon;
grant execute on function can_view_post(uuid) to authenticated;

-- ========== counter triggers (must be security definer) ==========
-- The liker doesn't own the post; a plain trigger's UPDATE would be
-- silently filtered to zero rows by update_posts and the counter never moves.

create or replace function bump_post_like_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_bump_post_like_count on post_likes;
create trigger trg_bump_post_like_count
  after insert or delete on post_likes
  for each row execute function bump_post_like_count();

create or replace function bump_post_comment_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      update posts set comment_count = comment_count + 1 where id = new.post_id;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      update posts set comment_count = greatest(comment_count - 1, 0) where id = new.post_id;
    elsif old.deleted_at is not null and new.deleted_at is null then
      update posts set comment_count = comment_count + 1 where id = new.post_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.deleted_at is null then
      update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_bump_post_comment_count on post_comments;
create trigger trg_bump_post_comment_count
  after insert or update or delete on post_comments
  for each row execute function bump_post_comment_count();

-- Notify post author on like / comment
create or replace function notify_on_post_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_author uuid;
  v_actor_name text;
begin
  select author_profile_id into v_author from posts where id = new.post_id;
  if v_author is null or v_author = new.profile_id then return new; end if;
  select display_name into v_actor_name from artist_profiles where id = new.profile_id;
  perform notify_profile_owner(
    v_author, new.profile_id, 'post_like',
    coalesce(v_actor_name, 'Someone') || ' liked your post',
    null, 'post', new.post_id, '/social?post=' || new.post_id::text,
    'post_like:' || new.post_id::text
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_post_like on post_likes;
create trigger trg_notify_on_post_like after insert on post_likes
  for each row execute function notify_on_post_like();

create or replace function notify_on_post_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_author uuid;
  v_actor_name text;
begin
  select author_profile_id into v_author from posts where id = new.post_id;
  if v_author is null or v_author = new.author_profile_id then return new; end if;
  select display_name into v_actor_name from artist_profiles where id = new.author_profile_id;
  perform notify_profile_owner(
    v_author, new.author_profile_id, 'post_comment',
    coalesce(v_actor_name, 'Someone') || ' commented on your post',
    left(new.body, 140), 'post', new.post_id, '/social?post=' || new.post_id::text,
    'post_comment:' || new.post_id::text
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_post_comment on post_comments;
create trigger trg_notify_on_post_comment after insert on post_comments
  for each row execute function notify_on_post_comment();

create or replace function notify_on_mention() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid;
  v_actor_name text;
  v_entity uuid;
  v_link text;
begin
  if new.post_id is not null then
    select author_profile_id into v_actor from posts where id = new.post_id;
    v_entity := new.post_id;
    v_link := '/social?post=' || new.post_id::text;
  else
    select author_profile_id, post_id into v_actor, v_entity
    from post_comments where id = new.comment_id;
    v_link := '/social?post=' || v_entity::text;
  end if;
  if v_actor is null or v_actor = new.mentioned_profile_id then return new; end if;
  select display_name into v_actor_name from artist_profiles where id = v_actor;
  perform notify_profile_owner(
    new.mentioned_profile_id, v_actor, 'mention',
    coalesce(v_actor_name, 'Someone') || ' mentioned you',
    null, 'post', v_entity, v_link,
    'mention:' || coalesce(new.post_id, new.comment_id)::text
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_mention on post_mentions;
create trigger trg_notify_on_mention after insert on post_mentions
  for each row execute function notify_on_mention();

-- ========== home_timeline (fan-out-on-read) ==========
-- security invoker so posts' own RLS still applies as defense in depth.

create or replace function home_timeline(p_limit int default 30, p_before timestamptz default null)
returns setof posts
language sql stable security invoker set search_path = public as $$
  select p.*
  from posts p
  where p.deleted_at is null
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

-- ========== posts RLS ==========
-- Inline SELECT so the planner can push the predicate into an index.

alter table posts enable row level security;
alter table post_likes enable row level security;
alter table post_comments enable row level security;
alter table post_mentions enable row level security;

drop policy if exists select_posts on posts;
create policy select_posts on posts for select
  to authenticated
  using (
    deleted_at is null
    and (
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
    )
  );

drop policy if exists insert_posts on posts;
create policy insert_posts on posts for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
    and owns_profile(author_profile_id)
    and (track_id is null or is_track_owner(track_id))
  );

drop policy if exists update_posts on posts;
create policy update_posts on posts for update
  to authenticated
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());

drop policy if exists delete_posts on posts;
create policy delete_posts on posts for delete
  to authenticated
  using (author_user_id = auth.uid());

-- Child tables via can_view_post
drop policy if exists select_post_likes on post_likes;
create policy select_post_likes on post_likes for select
  to authenticated
  using (can_view_post(post_id));

drop policy if exists insert_post_likes on post_likes;
create policy insert_post_likes on post_likes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and owns_profile(profile_id)
    and can_view_post(post_id)
  );

drop policy if exists delete_post_likes on post_likes;
create policy delete_post_likes on post_likes for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists select_post_comments on post_comments;
create policy select_post_comments on post_comments for select
  to authenticated
  using (can_view_post(post_id));

drop policy if exists insert_post_comments on post_comments;
create policy insert_post_comments on post_comments for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
    and owns_profile(author_profile_id)
    and can_view_post(post_id)
  );

drop policy if exists update_post_comments on post_comments;
create policy update_post_comments on post_comments for update
  to authenticated
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());

drop policy if exists delete_post_comments on post_comments;
create policy delete_post_comments on post_comments for delete
  to authenticated
  using (author_user_id = auth.uid());

drop policy if exists select_post_mentions on post_mentions;
create policy select_post_mentions on post_mentions for select
  to authenticated
  using (
    owns_profile(mentioned_profile_id)
    or (post_id is not null and can_view_post(post_id))
    or (
      comment_id is not null
      and exists (
        select 1 from post_comments c
        where c.id = comment_id and can_view_post(c.post_id)
      )
    )
  );

drop policy if exists insert_post_mentions on post_mentions;
create policy insert_post_mentions on post_mentions for insert
  to authenticated
  with check (
    (
      post_id is not null
      and exists (
        select 1 from posts p
        where p.id = post_id and p.author_user_id = auth.uid()
      )
    )
    or (
      comment_id is not null
      and exists (
        select 1 from post_comments c
        where c.id = comment_id and c.author_user_id = auth.uid()
      )
    )
  );

drop policy if exists delete_post_mentions on post_mentions;
create policy delete_post_mentions on post_mentions for delete
  to authenticated
  using (
    (
      post_id is not null
      and exists (
        select 1 from posts p
        where p.id = post_id and p.author_user_id = auth.uid()
      )
    )
    or (
      comment_id is not null
      and exists (
        select 1 from post_comments c
        where c.id = comment_id and c.author_user_id = auth.uid()
      )
    )
  );
