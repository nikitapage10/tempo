-- TEMPO migration 007 — track references (Prompt 8)

create table if not exists track_references (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  kind text not null check (kind in ('audio','image','link','note')),
  title text not null,
  url text,
  asset_id uuid references assets(id) on delete set null,
  note text,
  start_sec numeric,
  end_sec numeric,
  intent text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_track_references_track on track_references (track_id, sort);

alter table track_references enable row level security;

drop policy if exists own_track_references on track_references;
create policy own_track_references on track_references for all
  using (
    exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid())
  );
