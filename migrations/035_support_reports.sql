-- TEMPO migration 035 — member support and bug reports
-- Additive only. Run manually in the Supabase SQL editor after migration 034.

create table if not exists support_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  category text not null check (category in ('bug', 'help', 'feedback')),
  subject text not null check (char_length(subject) between 3 and 160),
  details text not null check (char_length(details) between 3 and 5000),
  page_url text,
  user_agent text,
  source text not null default 'manual' check (source in ('manual', 'assistant')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_support_reports_queue on support_reports (status, created_at desc);
create index if not exists idx_support_reports_user on support_reports (user_id, created_at desc);

alter table support_reports enable row level security;

drop policy if exists insert_own_support_reports on support_reports;
create policy insert_own_support_reports on support_reports for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and email = (auth.jwt() ->> 'email')
  );

-- Members intentionally get no SELECT/UPDATE policy. Reports are write-only
-- from the product and readable only through guarded admin service routes.
