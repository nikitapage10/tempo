-- TEMPO migration 067: deterministic Owl's Nest product demo
-- Depends on 060-066. Creates a rich private demo for the current account and
-- uses existing test accounts (when present) as authentic member personas.

create or replace function seed_owls_nest_demo() returns scenes
language plpgsql security definer set search_path = public as $$
declare
  v_scene scenes;
  v_user record;
  v_persona uuid;
  v_general uuid;
  v_chat uuid;
  v_events uuid;
  v_library uuid;
  v_showcase uuid;
  v_welcome uuid;
  v_conversation uuid;
  v_profile uuid;
  v_index int := 0;
  v_names text[] := array['Nikita Page','Elaine Huang','Jake Fabyanski','Hunter Rasmussen','Derek Vo','Jacalyn Blackwood','Jason Travis','Antonio Mejia'];
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into v_scene from scenes where owner_user_id = auth.uid() and name = 'The Owl''s Nest' and archived_at is null limit 1;
  if v_scene.id is null then
    select id into v_profile from artist_profiles where owner_user_id = auth.uid() order by created_at limit 1;
    insert into scenes (owner_user_id, owner_profile_id, name, slug, tagline, about, kind, join_policy, visibility, location, palette_id, public_summary, rules, timezone, published_at)
    values (auth.uid(), v_profile, 'The Owl''s Nest', 'owls-nest-' || left(replace(auth.uid()::text,'-',''), 10), 'Music makers learning, collaborating, and opening doors together.', 'The Owl''s Nest is a working collective for artists, producers, vocalists, managers, and creative people who believe progress moves faster in community.', 'collective', 'open', 'listed', 'Denver · New York · Online', 'afterglow', 'A music collective for honest feedback, meaningful relationships, and practical momentum.', 'Bring curiosity. Give specific feedback. Credit collaborators. Make room for emerging voices.', 'America/Denver', now()) returning * into v_scene;
  end if;

  -- Replace the generic defaults with the full demonstration information architecture.
  delete from scene_sections where scene_id = v_scene.id;
  insert into scene_sections (scene_id,type,name,slug,description,icon,sort_order,public_visible) values
    (v_scene.id,'page','Welcome','welcome','Start here: the culture, expectations, and quickest way into the room.','sparkles',10,true) returning id into v_welcome;
  insert into scene_sections (scene_id,type,name,slug,description,icon,sort_order) values
    (v_scene.id,'discussion','The Commons','commons','Introductions, questions, wins, and thoughtful discussion.','messages-square',20) returning id into v_general;
  insert into scene_sections (scene_id,type,name,slug,description,icon,sort_order) values
    (v_scene.id,'chat','Nest Chat','nest-chat','The live room for quick questions, check-ins, and connection.','message-circle',30) returning id into v_chat;
  insert into scene_sections (scene_id,type,name,slug,description,icon,sort_order,public_visible) values
    (v_scene.id,'events','Gatherings','gatherings','Mastermind sessions, listening rooms, and member meetups.','calendar-days',40,true) returning id into v_events;
  insert into scene_sections (scene_id,type,name,slug,description,icon,sort_order,public_visible) values
    (v_scene.id,'library','Flight Manual','flight-manual','Replays, templates, creative guides, and trusted tools.','book-open',50,true) returning id into v_library;
  insert into scene_sections (scene_id,type,name,slug,description,icon,sort_order,public_visible) values
    (v_scene.id,'showcase','Open Door','open-door','Member work, feedback requests, and projects worth hearing.','images',60,true) returning id into v_showcase;

  insert into scene_pages (scene_id,section_id,blocks,draft_blocks,published_at) values (v_scene.id,v_welcome,jsonb_build_array(
    jsonb_build_object('id','welcome-title','type','heading','data',jsonb_build_object('text','Welcome to the Owl''s Nest')),
    jsonb_build_object('id','welcome-copy','type','paragraph','data',jsonb_build_object('text','This is a room for people actively building careers and creative lives in music. Introduce yourself, share what you are making, and give before you ask.')),
    jsonb_build_object('id','welcome-callout','type','callout','data',jsonb_build_object('text','Start with one useful detail: what are you making, and what kind of collaborator would change the next six months?'))
  ),'[]'::jsonb,now());

  insert into scene_library_collections (scene_id,section_id,title,description,sort_order) values
    (v_scene.id,v_library,'Start Here','The highest-signal resources for new members.',10),
    (v_scene.id,v_library,'Session Replays','Recent workshops and mastermind conversations.',20);
  insert into scene_library_items (scene_id,section_id,kind,title,description,external_url,sort_order,published_at) values
    (v_scene.id,v_library,'template','Collaboration Split Sheet','A clean starting point for documenting ownership before release day.','https://example.com/split-sheet',10,now()),
    (v_scene.id,v_library,'replay','Building a Release Story','A practical workshop on making the world around a record feel coherent.','https://example.com/release-story',20,now()),
    (v_scene.id,v_library,'article','How to Ask for Useful Feedback','Turn “what do you think?” into a question collaborators can actually answer.','https://example.com/feedback',30,now());

  insert into scene_badges (scene_id,name,description,icon,color,points) values
    (v_scene.id,'Nest Builder','Welcomed people and strengthened the room.','🪺','#79D7FF',50),
    (v_scene.id,'Golden Ear','Consistently offered specific, useful feedback.','🎧','#FFB45E',75),
    (v_scene.id,'Open Door','Created an opportunity for another member.','🚪','#B8F3D4',100);

  -- Current account plus up to seven existing test accounts become real personas.
  for v_user in select id, email, raw_user_meta_data from auth.users order by case when id = auth.uid() then 0 else 1 end, created_at limit 8 loop
    v_index := v_index + 1;
    insert into scene_personas (scene_id,user_id,artist_profile_id,display_name,handle,bio,location,source)
    values (v_scene.id,v_user.id,(select id from artist_profiles where owner_user_id=v_user.id order by created_at limit 1),coalesce(v_user.raw_user_meta_data->>'full_name',v_names[least(v_index,array_length(v_names,1))],split_part(v_user.email,'@',1)),nullif(lower(regexp_replace(split_part(v_user.email,'@',1),'[^a-z0-9_]','','g')),''),'Making music, sharing perspective, and helping the room move forward.',case when v_index % 2 = 0 then 'New York, NY' else 'Denver, CO' end,'account')
    on conflict (scene_id,user_id) do update set bio=excluded.bio
    returning id into v_persona;
    insert into scene_members (scene_id,persona_id,user_id,profile_id,role,status,joined_at)
    values (v_scene.id,v_persona,v_user.id,(select artist_profile_id from scene_personas where id=v_persona),case when v_user.id=auth.uid() then 'owner' when v_index=2 then 'moderator' else 'member' end,'active',now()-(v_index||' days')::interval)
    on conflict (scene_id,user_id) do update set status='active';
  end loop;

  select id into v_persona from scene_personas where scene_id=v_scene.id and user_id=auth.uid();
  insert into posts (author_profile_id,author_user_id,author_scene_persona_id,body,visibility,scene_id,scene_section_id,kind,created_at) values
    (v_profile,auth.uid(),v_persona,'Welcome to the new Owl''s Nest. Drop your current project, the city you call home, and one thing you can help another member with.','members',v_scene.id,v_general,'announcement',now()-interval '2 days'),
    (v_profile,auth.uid(),v_persona,'Listening room this Thursday: bring one unfinished track and one very specific question. The goal is clarity, not consensus.','members',v_scene.id,v_general,'post',now()-interval '8 hours'),
    (v_profile,auth.uid(),v_persona,'Small win worth sharing: two members met here last month and their first co-write ships Friday. That is exactly what this room is for.','members',v_scene.id,v_general,'post',now()-interval '90 minutes');

  insert into scene_events (scene_id,scene_section_id,created_by_profile_id,created_by_user_id,created_by_persona_id,title,description,location,location_url,kind,all_day,starts_at,ends_at,timezone,capacity)
  values (v_scene.id,v_events,v_profile,auth.uid(),v_persona,'Owl''s Nest Listening Room','A focused feedback session: one work in progress, one question, and generous ears.','Online','https://example.com/owls-nest-live','listening',false,date_trunc('hour',now()+interval '5 days'),date_trunc('hour',now()+interval '5 days 90 minutes'),'America/Denver',24);

  insert into scene_showcase_items (scene_id,section_id,persona_id,title,description,feedback_prompt,external_url,visibility,status,featured_at)
  values (v_scene.id,v_showcase,v_persona,'Neon After Midnight','A melodic house record built around a field recording from the last Open Door session.','Does the second drop earn its extra sixteen bars?','https://example.com/neon-after-midnight','public','published',now());

  select id into v_conversation from conversations where scene_id=v_scene.id and scene_section_id=v_chat limit 1;
  if v_conversation is null then select ensure_scene_section_conversation(v_chat) into v_conversation; end if;
  insert into messages (conversation_id,sender_profile_id,sender_user_id,sender_scene_persona_id,body,created_at) values
    (v_conversation,v_profile,auth.uid(),v_persona,'Morning, Nest — what is everyone finishing this week?',now()-interval '3 hours'),
    (v_conversation,v_profile,auth.uid(),v_persona,'I added the split sheet and feedback guide to the Flight Manual.',now()-interval '2 hours 40 minutes'),
    (v_conversation,v_profile,auth.uid(),v_persona,'Listening room RSVP is open. Bring the version you are actually stuck on.',now()-interval '45 minutes');
  update scenes set member_count=(select count(*) from scene_members where scene_id=v_scene.id and status='active') where id=v_scene.id returning * into v_scene;
  return v_scene;
end;
$$;
revoke execute on function seed_owls_nest_demo() from public, anon;
grant execute on function seed_owls_nest_demo() to authenticated;
