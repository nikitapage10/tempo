-- TEMPO migration 004 — milestones + version decisions (Prompt 5)

alter table versions
  add column if not exists is_pinned boolean not null default false,
  add column if not exists milestone_type text
    check (milestone_type is null or milestone_type in (
      'demo','vocal_comp','arrangement_lock','mix_approved','master','custom'
    )),
  add column if not exists milestone_label text,
  add column if not exists pinned_at timestamptz;

create table if not exists version_decisions (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id) on delete cascade,
  version_id uuid not null references versions(id) on delete cascade,
  decision_type text not null check (decision_type in ('approved','needs_changes','rejected')),
  decision_area text not null check (decision_area in (
    'general','arrangement','vocal','mix','master','release'
  )),
  note text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  guest_name text,
  guest_link_id uuid references guest_review_links(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_version_decisions_track on version_decisions (track_id, created_at desc);
create index if not exists idx_version_decisions_version on version_decisions (version_id);
create index if not exists idx_versions_pinned on versions (track_id, is_pinned);

alter table version_decisions enable row level security;

drop policy if exists own_version_decisions on version_decisions;
create policy own_version_decisions on version_decisions for all
  using (
    exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from tracks t where t.id = track_id and t.user_id = auth.uid())
  );
