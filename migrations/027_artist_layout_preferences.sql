-- TEMPO migration 027 — artist overview layout, moved from the browser to the account
-- Additive only. Run in Supabase SQL Editor. Drops nothing, rewrites nothing.
--
-- The Artist page's "Edit layout" arrangement used to live in localStorage,
-- reasoned as "a per-person view preference with no collaboration story."
-- That held up fine until custom stat modules (migration 025) made the split
-- obvious and confusing: the module's data synced everywhere, but where it
-- sat on the page stayed stuck to whichever single browser saved it. This
-- table makes the arrangement follow the person instead of the device.

create table if not exists artist_layout_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  -- Same shape as the old localStorage value: { v: 1, layout: {...}, known: [...] }.
  preferences jsonb not null,
  updated_at timestamptz not null default now(),

  unique (user_id, artist_id)
);

create index if not exists idx_artist_layout_prefs_lookup
  on artist_layout_preferences (user_id, artist_id);

alter table artist_layout_preferences enable row level security;

drop policy if exists own_artist_layout_prefs on artist_layout_preferences;
create policy own_artist_layout_prefs on artist_layout_preferences for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from artists a where a.id = artist_id and a.user_id = auth.uid())
  );
