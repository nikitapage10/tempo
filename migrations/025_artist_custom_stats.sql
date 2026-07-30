-- TEMPO migration 025 — custom, hand-entered stat modules for the Artist page
-- Additive only. Run in Supabase SQL Editor. Drops nothing, rewrites nothing.
--
-- Real platform stats stop at whatever Spotify/SoundCloud/Apple actually
-- expose (migration 024). Anything else a musician wants to track — sync
-- placements, merch sold, radio spins, whatever — has nowhere to live. These
-- three tables let someone build their own module: a titled card holding any
-- number of named stats, each logged by hand over time so it still gets a
-- trend line rather than just a single overwritten number.

create table if not exists artist_custom_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  title text not null,
  -- Position among a person's own custom modules; the layout engine tracks
  -- where the module sits on the page separately (module_layout / localStorage).
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_artist_custom_modules_artist
  on artist_custom_modules (artist_id, sort_order);

create table if not exists artist_custom_stats (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references artist_custom_modules(id) on delete cascade,
  label text not null,
  -- Free-text suffix shown after the value ("$", "plays", "%"). Null = none.
  unit text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_artist_custom_stats_module
  on artist_custom_stats (module_id, sort_order);

create table if not exists artist_custom_stat_entries (
  id uuid primary key default gen_random_uuid(),
  stat_id uuid not null references artist_custom_stats(id) on delete cascade,
  value numeric not null,
  -- The date this reading is *of*, not when it was typed in — lets someone
  -- back-fill an earlier number without today's date skewing the trend.
  recorded_on date not null default current_date,
  created_at timestamptz not null default now(),

  -- One entry per stat per day; logging again today overwrites rather than
  -- double-counting, same rule platform_snapshots uses.
  unique (stat_id, recorded_on)
);

create index if not exists idx_artist_custom_stat_entries_stat
  on artist_custom_stat_entries (stat_id, recorded_on);

alter table artist_custom_modules enable row level security;
alter table artist_custom_stats enable row level security;
alter table artist_custom_stat_entries enable row level security;

drop policy if exists own_custom_modules on artist_custom_modules;
create policy own_custom_modules on artist_custom_modules for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from artists a where a.id = artist_id and a.user_id = auth.uid())
  );

drop policy if exists own_custom_stats on artist_custom_stats;
create policy own_custom_stats on artist_custom_stats for all
  using (
    exists (
      select 1 from artist_custom_modules m
      where m.id = module_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from artist_custom_modules m
      where m.id = module_id and m.user_id = auth.uid()
    )
  );

drop policy if exists own_custom_stat_entries on artist_custom_stat_entries;
create policy own_custom_stat_entries on artist_custom_stat_entries for all
  using (
    exists (
      select 1 from artist_custom_stats s
      join artist_custom_modules m on m.id = s.module_id
      where s.id = stat_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from artist_custom_stats s
      join artist_custom_modules m on m.id = s.module_id
      where s.id = stat_id and m.user_id = auth.uid()
    )
  );
