-- TEMPO migration 003 — guest review links (Prompt 4)
-- Additive only. No anon select policies — server validates tokens via service role.

create table if not exists guest_review_links (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  version_id uuid not null references versions(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text,
  expires_at timestamptz,
  revoked_at timestamptz,
  allow_comments boolean not null default true,
  allow_download boolean not null default false,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

create index if not exists idx_guest_links_track on guest_review_links (track_id);
create index if not exists idx_guest_links_version on guest_review_links (version_id);
create index if not exists idx_guest_links_token on guest_review_links (token_hash)
  where revoked_at is null;

alter table comments
  add column if not exists guest_name text,
  add column if not exists guest_link_id uuid;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'comments_guest_link_id_fkey'
  ) then
    alter table comments
      add constraint comments_guest_link_id_fkey
      foreign key (guest_link_id) references guest_review_links(id) on delete set null;
  end if;
end $$;

alter table guest_review_links enable row level security;

drop policy if exists own_guest_links on guest_review_links;
create policy own_guest_links on guest_review_links for all
  using (
    exists (
      select 1 from tracks t
      where t.id = track_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from tracks t
      where t.id = track_id and t.user_id = auth.uid()
    )
  );
