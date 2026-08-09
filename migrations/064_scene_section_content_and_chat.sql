-- TEMPO migration 064: Section-aware content and multi-room chat
-- Depends on 063.

alter table posts add column if not exists scene_section_id uuid references scene_sections(id) on delete set null;
alter table scene_events add column if not exists scene_section_id uuid references scene_sections(id) on delete set null;
alter table conversations add column if not exists scene_section_id uuid references scene_sections(id) on delete cascade;
alter table messages add column if not exists reply_to_message_id uuid references messages(id) on delete set null;

-- Migration 053's original room index predates section-level chat and treats
-- every non-topic conversation as the one Scene room. Narrow it so a Scene
-- may retain that legacy room while also having one conversation per section.
drop index if exists uq_conversations_scene_room;
create unique index uq_conversations_scene_room
  on conversations (scene_id)
  where scene_id is not null
    and scene_topic_id is null
    and scene_section_id is null;

update posts p set scene_section_id = s.id
from scene_sections s
where p.scene_id = s.scene_id and s.type = 'discussion' and s.slug = 'general'
  and p.scene_id is not null and p.scene_section_id is null;
update scene_events e set scene_section_id = s.id
from scene_sections s
where e.scene_id = s.scene_id and s.type = 'events' and e.scene_section_id is null;
update conversations c set scene_section_id = s.id
from scene_sections s
where c.scene_id = s.scene_id and s.type = 'chat' and s.slug = 'chat'
  and c.scene_section_id is null;

create unique index if not exists uq_conversation_scene_section
  on conversations (scene_section_id) where scene_section_id is not null;
create index if not exists idx_posts_scene_section
  on posts (scene_section_id, created_at desc) where deleted_at is null;
create index if not exists idx_scene_events_section
  on scene_events (scene_section_id, starts_at) where cancelled_at is null;

create table if not exists scene_message_reactions (
  message_id uuid not null references messages(id) on delete cascade,
  scene_id uuid not null references scenes(id) on delete cascade,
  persona_id uuid not null references scene_personas(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, persona_id, emoji),
  constraint scene_message_reaction_emoji_len check (char_length(emoji) between 1 and 16)
);
alter table scene_message_reactions enable row level security;
drop policy if exists view_scene_message_reactions on scene_message_reactions;
drop policy if exists create_scene_message_reactions on scene_message_reactions;
drop policy if exists delete_scene_message_reactions on scene_message_reactions;
create policy view_scene_message_reactions on scene_message_reactions for select to authenticated
  using (is_scene_member(scene_id));
create policy create_scene_message_reactions on scene_message_reactions for insert to authenticated
  with check (is_scene_member(scene_id) and persona_id = scene_persona_id(scene_id));
create policy delete_scene_message_reactions on scene_message_reactions for delete to authenticated
  using (persona_id = scene_persona_id(scene_id));

create or replace function ensure_scene_section_conversation(p_section_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_scene uuid; v_name text; v_conversation uuid; v_persona uuid;
begin
  select scene_id, name into v_scene, v_name from scene_sections
  where id = p_section_id and type = 'chat' and archived_at is null;
  if v_scene is null or not is_scene_manager(v_scene) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select id into v_conversation from conversations where scene_section_id = p_section_id;
  if v_conversation is not null then return v_conversation; end if;
  v_persona := scene_persona_id(v_scene);
  insert into conversations (kind, title, created_by_scene_persona_id, scene_id, scene_section_id)
  values ('group', v_name, v_persona, v_scene, p_section_id) returning id into v_conversation;
  insert into conversation_participants (conversation_id, profile_id, scene_persona_id, user_id, role)
  select v_conversation, m.profile_id, m.persona_id, m.user_id,
    case when m.role in ('owner','moderator') then 'admin' else 'member' end
  from scene_members m where m.scene_id = v_scene and m.status = 'active'
  on conflict (conversation_id, user_id) do nothing;
  return v_conversation;
end;
$$;
revoke execute on function ensure_scene_section_conversation(uuid) from public, anon;
grant execute on function ensure_scene_section_conversation(uuid) to authenticated;

drop policy if exists insert_messages on messages;
create policy insert_messages on messages for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and is_conversation_participant(conversation_id)
    and (
      (sender_profile_id is not null and owns_profile(sender_profile_id))
      or sender_scene_persona_id in (
        select p.id from scene_personas p where p.user_id = auth.uid()
      )
    )
  );
