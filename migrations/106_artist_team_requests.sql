-- TEMPO migration 106: Pro-initiated requests to join an artist team.
-- Additive and rerunnable. Run after 105.
--
-- A request is deliberately separate from artist_members: asking to join
-- grants no workspace access. The artist can decline it or turn it into the
-- existing pending invitation, where the Pro reviews the exact access before
-- accepting.

create table if not exists artist_team_requests (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_profile_id uuid not null references artist_profiles(id) on delete cascade,
  requested_role text not null check (requested_role in
    ('manager', 'agent', 'tour_manager', 'label', 'assistant', 'custom')),
  note text check (note is null or char_length(note) <= 1000),
  status text not null default 'pending' check (status in
    ('pending', 'invited', 'declined', 'cancelled')),
  membership_id uuid references artist_members(id) on delete set null,
  responded_by_user_id uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists artist_team_requests_one_pending
  on artist_team_requests (artist_id, requester_user_id)
  where status = 'pending';
create index if not exists idx_artist_team_requests_requester
  on artist_team_requests (requester_user_id, created_at desc);
create index if not exists idx_artist_team_requests_artist
  on artist_team_requests (artist_id, status, created_at desc);

create or replace function touch_artist_team_request_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_artist_team_requests_updated_at on artist_team_requests;
create trigger trg_artist_team_requests_updated_at
  before update on artist_team_requests
  for each row execute function touch_artist_team_request_updated_at();

alter table artist_team_requests enable row level security;

-- Reads are intentionally bilateral. Writes go through authenticated server
-- routes, which verify the Pro identity and artist ownership before using the
-- service role. There is no browser-side INSERT/UPDATE policy to bypass.
drop policy if exists bilateral_read_artist_team_requests on artist_team_requests;
create policy bilateral_read_artist_team_requests on artist_team_requests for select
  using (
    requester_user_id = auth.uid()
    or exists (
      select 1 from artists a
      where a.id = artist_id and a.user_id = auth.uid()
    )
  );

insert into schema_migrations(version, name, checksum, applied_by)
values(106, '106_artist_team_requests', 'initial', 'migration-self-register')
on conflict(version) do nothing;
