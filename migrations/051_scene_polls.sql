-- TEMPO migration 051 — Scenes, part 3: polls, open questions, scheduled prompts
-- Additive. Depends on 049 and 050.
--
-- Two shapes, one table set:
--   * a POLL is a post with kind='poll' plus options members vote on.
--   * an OPEN QUESTION is a post with kind='question' and NO options —
--     answers are ordinary post_comments. That is the whole implementation:
--     threading, @mentions, comment counts, edit, soft-delete and moderation
--     all already exist and need no new code on either side of the stack.

-- ---------- scheduled prompts ----------
-- A scheduled question is an ordinary scene post with a future scheduled_for.
-- Visibility is enforced by the feed function AND the policy below, so
-- nothing needs a cron job to become correct — the cron in
-- app/api/cron/scene-scheduled-posts only sends the notification.

alter table posts
  add column if not exists scheduled_for timestamptz;

create index if not exists idx_posts_scene_scheduled
  on posts (scene_id, scheduled_for)
  where scheduled_for is not null and deleted_at is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_scheduled_needs_scene') then
    alter table posts add constraint posts_scheduled_needs_scene
      check (scheduled_for is null or scene_id is not null);
  end if;
end $$;

-- ---------- tables ----------

create table if not exists scene_polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references posts(id) on delete cascade,
  -- Denormalized so this table's policy calls is_scene_member(scene_id)
  -- directly instead of joining posts and re-evaluating its RLS per row.
  scene_id uuid not null references scenes(id) on delete cascade,
  kind text not null default 'poll' check (kind in ('poll', 'question')),
  multi_choice boolean not null default false,
  closes_at timestamptz,
  closed_at timestamptz,
  total_votes int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_scene_polls_scene on scene_polls (scene_id, created_at desc);

create table if not exists scene_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references scene_polls(id) on delete cascade,
  scene_id uuid not null references scenes(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  vote_count int not null default 0,
  constraint scene_poll_options_label_len check (char_length(trim(label)) between 1 and 120)
);

create index if not exists idx_scene_poll_options_poll on scene_poll_options (poll_id, sort_order);

create table if not exists scene_poll_votes (
  option_id uuid not null references scene_poll_options(id) on delete cascade,
  profile_id uuid not null references artist_profiles(id) on delete cascade,
  poll_id uuid not null references scene_polls(id) on delete cascade,
  scene_id uuid not null references scenes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (option_id, profile_id)
);

create index if not exists idx_scene_poll_votes_poll on scene_poll_votes (poll_id, profile_id);

-- ---------- counters (security definer) ----------

create or replace function bump_scene_poll_counts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update scene_poll_options set vote_count = vote_count + 1 where id = new.option_id;
    update scene_polls set total_votes = total_votes + 1 where id = new.poll_id;
    return new;
  elsif tg_op = 'DELETE' then
    update scene_poll_options set vote_count = greatest(vote_count - 1, 0) where id = old.option_id;
    update scene_polls set total_votes = greatest(total_votes - 1, 0) where id = old.poll_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_bump_scene_poll_counts on scene_poll_votes;
create trigger trg_bump_scene_poll_counts
  after insert or delete on scene_poll_votes
  for each row execute function bump_scene_poll_counts();

-- ---------- voting ----------
-- A single-choice re-vote is a delete + insert that must not be observable as
-- a moment with zero votes, and a multi-choice submission must not half-land.
-- Both are therefore one definer transaction rather than client-side calls.

create or replace function cast_scene_poll_vote(
  p_poll_id uuid,
  p_option_ids uuid[],
  p_profile_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_scene uuid;
  v_multi boolean;
  v_closed timestamptz;
  v_closes timestamptz;
  v_kind text;
  v_opt uuid;
begin
  select scene_id, multi_choice, closed_at, closes_at, kind
  into v_scene, v_multi, v_closed, v_closes, v_kind
  from scene_polls where id = p_poll_id;

  if v_scene is null then
    raise exception 'That poll is not available' using errcode = '42501';
  end if;
  if v_kind <> 'poll' then
    raise exception 'Open questions are answered in the comments' using errcode = '22023';
  end if;
  if not owns_profile(p_profile_id) then
    raise exception 'Not your profile' using errcode = '42501';
  end if;
  if not is_scene_member(v_scene) then
    raise exception 'Join the scene to vote' using errcode = '42501';
  end if;
  if v_closed is not null or (v_closes is not null and v_closes <= now()) then
    raise exception 'That poll has closed' using errcode = '42501';
  end if;
  if p_option_ids is null or array_length(p_option_ids, 1) is null then
    raise exception 'Pick an option' using errcode = '22023';
  end if;
  if not v_multi and array_length(p_option_ids, 1) > 1 then
    raise exception 'That poll takes one answer' using errcode = '22023';
  end if;

  -- Every option must belong to this poll — never trust the ids from the client.
  if exists (
    select 1 from unnest(p_option_ids) o(id)
    where not exists (
      select 1 from scene_poll_options po where po.id = o.id and po.poll_id = p_poll_id
    )
  ) then
    raise exception 'Unknown option' using errcode = '22023';
  end if;

  delete from scene_poll_votes
  where poll_id = p_poll_id and profile_id = p_profile_id;

  foreach v_opt in array p_option_ids loop
    insert into scene_poll_votes (option_id, profile_id, poll_id, scene_id, user_id)
    values (v_opt, p_profile_id, p_poll_id, v_scene, auth.uid())
    on conflict do nothing;
  end loop;
end;
$$;

create or replace function close_scene_poll(p_poll_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_scene uuid;
  v_author uuid;
begin
  select sp.scene_id, p.author_user_id into v_scene, v_author
  from scene_polls sp join posts p on p.id = sp.post_id
  where sp.id = p_poll_id;
  if v_scene is null then return; end if;
  if v_author <> auth.uid() and not is_scene_manager(v_scene) then
    raise exception 'Only the author or a scene moderator can close this' using errcode = '42501';
  end if;
  update scene_polls set closed_at = now() where id = p_poll_id and closed_at is null;
end;
$$;

revoke execute on function cast_scene_poll_vote(uuid, uuid[], uuid) from public, anon;
revoke execute on function close_scene_poll(uuid) from public, anon;
grant execute on function cast_scene_poll_vote(uuid, uuid[], uuid) to authenticated;
grant execute on function close_scene_poll(uuid) to authenticated;

-- ---------- feed: hide unpublished scheduled posts ----------
-- Replaces the 050 definition. Not a no-op: adds the scheduled_for gate.

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
    and (p.scheduled_for is null or p.scheduled_for <= now())
    and (p_topic_id is null or p.scene_topic_id = p_topic_id)
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke execute on function scene_feed(uuid, uuid, int, timestamptz) from public, anon;
grant execute on function scene_feed(uuid, uuid, int, timestamptz) to authenticated;

-- ---------- select_posts: gate scheduled posts in the policy too ----------
-- The feed function alone is not a permission boundary — a client can select
-- from `posts` directly. Only the SCENE branch changes; the non-scene branch
-- below is still the verbatim 030 text, exactly as 050 left it.

drop policy if exists select_posts on posts;
create policy select_posts on posts for select
  to authenticated
  using (
    deleted_at is null
    and (
      -- ===== scene branch (050, + scheduled gate added in 051) =====
      (
        scene_id is not null
        and can_view_scene(scene_id)
        and (
          scheduled_for is null
          or scheduled_for <= now()
          or author_user_id = auth.uid()
          or is_scene_manager(scene_id)
        )
      )
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

-- ---------- RLS ----------

alter table scene_polls enable row level security;
alter table scene_poll_options enable row level security;
alter table scene_poll_votes enable row level security;

drop policy if exists select_scene_polls on scene_polls;
create policy select_scene_polls on scene_polls for select
  to authenticated using (can_view_scene(scene_id));

drop policy if exists insert_scene_polls on scene_polls;
create policy insert_scene_polls on scene_polls for insert
  to authenticated
  with check (
    is_scene_member(scene_id)
    -- The poll must hang off a post the caller just authored in this scene.
    and exists (
      select 1 from posts p
      where p.id = post_id
        and p.author_user_id = auth.uid()
        and p.scene_id = scene_polls.scene_id
    )
  );

drop policy if exists update_scene_polls on scene_polls;
create policy update_scene_polls on scene_polls for update
  to authenticated
  using (
    exists (select 1 from posts p where p.id = post_id and p.author_user_id = auth.uid())
    or is_scene_manager(scene_id)
  )
  with check (
    exists (select 1 from posts p where p.id = post_id and p.author_user_id = auth.uid())
    or is_scene_manager(scene_id)
  );

drop policy if exists select_scene_poll_options on scene_poll_options;
create policy select_scene_poll_options on scene_poll_options for select
  to authenticated using (can_view_scene(scene_id));

drop policy if exists insert_scene_poll_options on scene_poll_options;
create policy insert_scene_poll_options on scene_poll_options for insert
  to authenticated
  with check (
    exists (
      select 1 from scene_polls sp join posts p on p.id = sp.post_id
      where sp.id = poll_id
        and p.author_user_id = auth.uid()
        -- Pin the denormalized scene_id to the poll's own. Without this a
        -- client could file an option under a scene it doesn't belong to and
        -- make the label readable there via select_scene_poll_options.
        and sp.scene_id = scene_poll_options.scene_id
    )
  );

-- Results are visible to the room; who voted for what is visible to the room
-- too, deliberately — a scene poll is a show of hands, not a secret ballot.
drop policy if exists select_scene_poll_votes on scene_poll_votes;
create policy select_scene_poll_votes on scene_poll_votes for select
  to authenticated using (can_view_scene(scene_id));

-- No direct write path: voting is cast_scene_poll_vote() only, so the
-- single-choice rule and the option-ownership check cannot be bypassed.
drop policy if exists insert_scene_poll_votes on scene_poll_votes;
create policy insert_scene_poll_votes on scene_poll_votes for insert
  to authenticated with check (false);

drop policy if exists delete_scene_poll_votes on scene_poll_votes;
create policy delete_scene_poll_votes on scene_poll_votes for delete
  to authenticated using (user_id = auth.uid());
