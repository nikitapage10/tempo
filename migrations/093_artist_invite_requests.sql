-- TEMPO migration 093 — artist invite requests (beta gate)
-- Additive only. Drops nothing, truncates nothing.
--
-- During beta, only a platform admin may send a full TEMPO artist invite.
-- Members can still invite team members and track collaborators on their own.
-- Asking someone to join as a full artist creates a pending request here;
-- Admin approves it, then the usual invites row is created and emailed.
--
-- Run in the Supabase SQL editor after 092, on a non-production project first.

create table if not exists artist_invite_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete cascade,
  email text not null,
  note text,
  track_id uuid references tracks(id) on delete set null,
  artist_id uuid references artists(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  invite_id uuid references invites(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_artist_invite_requests_status
  on artist_invite_requests (status, created_at desc);

create unique index if not exists artist_invite_requests_pending_email
  on artist_invite_requests (lower(email))
  where status = 'pending';

alter table artist_invite_requests enable row level security;

drop policy if exists own_artist_invite_requests_select on artist_invite_requests;
create policy own_artist_invite_requests_select on artist_invite_requests
  for select using (requested_by = auth.uid());

drop policy if exists own_artist_invite_requests_insert on artist_invite_requests;
create policy own_artist_invite_requests_insert on artist_invite_requests
  for insert with check (
    requested_by = auth.uid()
    and status = 'pending'
  );
