-- TEMPO migration 086 — performance log (shows, festivals, sets played)
-- Additive only. calendar_events is untouched; a performance may optionally
-- link back to the calendar_events row it was planned as.
--
-- Why a new table instead of extending calendar_events: calendar_events is
-- scoped by space_id with no artist_id, so it cannot answer "shows for this
-- artist" across every space they own; its `kind` became open-ended user
-- text in migration 075, which can't underpin a number that has to stay
-- explainable; it is a *planning* surface whose completed_at checkbox is
-- rarely ticked after the fact, so counting "shows played" from it would
-- systematically undercount; and an artist needs to log shows played before
-- they ever used TEMPO, which a calendar entry can't represent honestly.

create table if not exists performances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  -- The planned calendar entry this played set corresponds to, if any.
  calendar_event_id uuid references calendar_events(id) on delete set null,

  title text not null,
  performed_on date not null,
  role text not null default 'performer'
    check (role in ('headline', 'performer', 'support', 'dj', 'host', 'crew')),
  context text not null default 'show'
    check (context in ('show', 'festival', 'residency', 'livestream', 'radio', 'session')),
  festival_name text,
  venue text,
  city text,
  country text,
  set_minutes int check (set_minutes is null or set_minutes between 1 and 600),
  audience_estimate int check (audience_estimate is null or audience_estimate >= 0),
  paid boolean,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint performances_title_length check (char_length(btrim(title)) between 1 and 160),
  constraint performances_festival_named
    check (festival_name is null or context = 'festival'),
  constraint performances_text_lengths check (
    coalesce(char_length(venue), 0) <= 160
    and coalesce(char_length(city), 0) <= 120
    and coalesce(char_length(country), 0) <= 120
    and coalesce(char_length(notes), 0) <= 4000
    and coalesce(char_length(festival_name), 0) <= 160
  )
);

create index if not exists idx_performances_artist_date
  on performances (artist_id, performed_on desc);
create unique index if not exists uq_performances_calendar_event
  on performances (calendar_event_id) where calendar_event_id is not null;

alter table performances enable row level security;

drop policy if exists own_performances on performances;
create policy own_performances on performances for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from artists a where a.id = artist_id and a.user_id = auth.uid())
  );

create or replace function set_performances_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_performances_updated_at on performances;
create trigger trg_performances_updated_at
  before update on performances
  for each row execute function set_performances_updated_at();
