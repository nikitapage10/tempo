-- TEMPO migration 002 — timestamped comments (Prompt 3)
-- Preserves existing comments rows. Additive only.

alter table comments
  add column if not exists track_id uuid references tracks(id) on delete cascade,
  add column if not exists author_user_id uuid references auth.users(id) on delete set null,
  add column if not exists parent_id uuid references comments(id) on delete cascade,
  add column if not exists assigned_to_user_id uuid references auth.users(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists guest_name text,
  add column if not exists guest_link_id uuid;

-- Backfill track_id from versions
update comments c
set track_id = v.track_id
from versions v
where c.version_id = v.id
  and c.track_id is null;

-- Only tighten NOT NULL when every row has track_id
do $$
begin
  if not exists (select 1 from comments where track_id is null) then
    alter table comments alter column track_id set not null;
  end if;
end $$;

-- Sync resolved boolean <-> resolved_at
create or replace function sync_comment_resolved() returns trigger as $$
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.resolved and new.resolved_at is null then
      new.resolved_at := now();
    elsif not new.resolved then
      new.resolved_at := null;
      new.resolved_by_user_id := null;
    end if;
    if new.resolved_at is not null and not new.resolved then
      new.resolved := true;
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_comment_resolved on comments;
create trigger trg_sync_comment_resolved
  before insert or update on comments
  for each row execute function sync_comment_resolved();

create index if not exists idx_comments_version_ts on comments (version_id, timestamp_sec);
create index if not exists idx_comments_track_resolved on comments (track_id, resolved);
create index if not exists idx_comments_parent on comments (parent_id);
create index if not exists idx_comments_assigned on comments (assigned_to_user_id);

drop policy if exists own_comments on comments;
create policy own_comments on comments for all
  using (
    exists (
      select 1 from tracks t
      where t.id = comments.track_id and t.user_id = auth.uid()
    )
    or exists (
      select 1 from versions v
      join tracks t on t.id = v.track_id
      where v.id = comments.version_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from tracks t
      where t.id = comments.track_id and t.user_id = auth.uid()
    )
    or exists (
      select 1 from versions v
      join tracks t on t.id = v.track_id
      where v.id = comments.version_id and t.user_id = auth.uid()
    )
  );
