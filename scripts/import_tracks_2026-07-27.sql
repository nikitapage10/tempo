-- One-off data import — NOT a schema migration, does not belong in /migrations.
-- Adds 6 tracks to nikitapage10@gmail.com's "Originals" space. Additive only;
-- never touches existing rows. Safe to re-run: each track is skipped if a
-- track with that exact title already exists for this user.
--
-- Assumptions — check these before running, edit the values below if wrong:
--   1. Target space is named 'Originals' (your default space).
--   2. New tracks land in the 'Released' stage (they already have external
--      play counts, so they read as already-out tracks, not works in progress).
--      If your space has no stage named 'Released', stage_id is left null and
--      the track just shows "No stage" until you set one.
--   3. type = 'original', momentum = 'parked' (finished/catalog, not being
--      actively worked) for all 6 — change per-row below if any should be
--      'active' instead.
--
-- Heads up: "Things You Love The Most (feat. SOUNDR)" looks like it may
-- already exist in your Originals space under a slightly different title
-- ("Things You Love the Most (feat.SOUNDR)" — different capitalization/
-- spacing). Because the titles aren't byte-identical, this script will NOT
-- treat them as the same track and will insert a second row. Check for a
-- duplicate afterward and delete the one you don't want, or edit the title
-- in the VALUES list below to match the existing row exactly before running.

with target_user as (
  select id as user_id
  from auth.users
  where email = 'nikitapage10@gmail.com'
),
target_space as (
  select s.id as space_id
  from spaces s
  join target_user u on s.user_id = u.user_id
  where s.name = 'Originals'
  limit 1
),
target_stage as (
  select st.id as stage_id
  from stages st
  join target_space sp on st.space_id = sp.space_id
  where st.name = 'Released'
  limit 1
),
new_tracks (title) as (
  values
    ('Take What You Want (feat. Manno)'),
    ('Things You Love The Most (feat. SOUNDR)'),
    ('Here We Go Again (Chandler Leighton & Shawn O''Donnell) - Vanthe'),
    ('Nowhere To Be Found (feat. Anna-Sophia Henry)'),
    ('Battle Wounds (feat. Medyk) - CHPTR.'),
    ('Fade To Dust (feat. WISNER & KIDNAMEDCAM)')
)
insert into tracks (user_id, space_id, stage_id, title, type, momentum)
select
  u.user_id,
  sp.space_id,
  st.stage_id,
  nt.title,
  'original',
  'parked'
from new_tracks nt
cross join target_user u
cross join target_space sp
left join target_stage st on true
where not exists (
  select 1 from tracks t
  where t.user_id = u.user_id and t.title = nt.title
)
returning id, title, stage_id;

-- If this returns 0 rows and you expected 6, the most likely cause is that
-- target_user or target_space matched nothing — run these two checks:
--   select id, email from auth.users where email = 'nikitapage10@gmail.com';
--   select id, name from spaces where user_id = '<id from above>';
-- and fix the space name in this script to match, then re-run.
