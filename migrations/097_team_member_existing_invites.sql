-- TEMPO migration 097 — existing-member team invites
-- Additive only. Drops nothing, truncates nothing.
--
-- Artists can invite someone already on TEMPO (by handle or email). That
-- person gets an in-app notification and must approve before the membership
-- becomes active. These indexes keep a second pending/active row from
-- landing for the same artist + person.
--
-- Run in the Supabase SQL editor after 096.

create unique index if not exists artist_members_pending_email
  on artist_members (artist_id, lower(invited_email))
  where status = 'pending' and invited_email is not null;

create unique index if not exists artist_members_pending_user
  on artist_members (artist_id, user_id)
  where status = 'pending' and user_id is not null;

create unique index if not exists artist_members_active_user
  on artist_members (artist_id, user_id)
  where status = 'active' and user_id is not null;
