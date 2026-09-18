-- TEMPO migration 119: remove the ghostwritten Green Room starter content.
--
-- First-run provisioning used to seed the starter Scene with two feed posts
-- and two chat messages, attributed to real members' profiles — the inviter,
-- a team account, or whichever published artist happened to be picked. Those
-- people never wrote the words and were never asked, and every other member
-- of the room saw them as genuine posts.
--
-- Migration 077 did this for the main Social feed. The Scene feed and Scene
-- chat were missed. The application no longer writes any of it (the four
-- strings survive in code only as RETIRED_SCENE_STARTERS and
-- RETIRED_CHAT_STARTERS, to keep this cleanup and its test in sync).
--
-- Deletes only rows whose body is an exact match for one of the four seeded
-- strings. A member who typed the same sentence themselves would have to have
-- reproduced it character for character; the additional conditions below
-- (scene post, empty media) narrow it further. Nothing else is touched: no
-- table is dropped, no policy weakened, no member content removed.

-- The two seeded feed posts. Likes, comments, and mentions all declare
-- `on delete cascade` against posts(id) (migration 030), so they go with the
-- post rather than being left pointing at nothing.
delete from posts
where scene_id is not null
  and media = '[]'::jsonb
  and body in (
    'Welcome to the Green Room. Introduce yourself and tell us what kind of music you are working on.',
    'A good place to begin: share one thing you want to finish this month and one thing you want feedback on.'
  );

-- The two seeded chat messages, scoped to Scene conversations so an identical
-- sentence in a private thread is left alone.
delete from messages message
using conversations conversation
where message.conversation_id = conversation.id
  and conversation.scene_id is not null
  and message.body in (
    'Welcome in! This room is here so you can see how a Scene conversation feels.',
    'Say hello whenever you are ready, or share the song that has been living in your head lately.'
  );

insert into schema_migrations (version, name, checksum, applied_by)
values (119, '119_remove_ghostwritten_scene_starters', 'initial', 'migration-self-register')
on conflict (version) do nothing;
