-- Keep Nikita's automated outbound welcomes out of her artist inbox until the
-- new member replies. PostgreSQL's infinity timestamp is reserved as a hidden
-- sentinel: normal archived conversations always contain a finite timestamp.

create or replace function unarchive_direct_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversation_participants
  set archived_at = case
    -- Sending another outbound message must not reveal an unanswered welcome
    -- in the sender's own inbox. A message from a different user does.
    when archived_at = 'infinity'::timestamptz
      and user_id = new.sender_user_id
      then archived_at
    else null
  end
  where conversation_id = new.conversation_id;
  return new;
end;
$$;

-- This runs after trg_unarchive_direct_conversation alphabetically, leaving
-- the automated welcome sender hidden after the initial insert.
create or replace function hide_nikita_welcome_for_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.suppress_notification
    and new.body like 'Hey, thanks for joining TEMPO! I''m Nikita,%'
  then
    update conversation_participants
    set archived_at = 'infinity'::timestamptz
    where conversation_id = new.conversation_id
      and user_id = new.sender_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_zz_hide_nikita_welcome_for_sender on messages;
create trigger trg_zz_hide_nikita_welcome_for_sender
  after insert on messages
  for each row execute function hide_nikita_welcome_for_sender();

-- Hide existing welcome-only threads for Nikita. Any conversation that has
-- ever received a message from the other user remains visible.
update conversation_participants cp
set archived_at = 'infinity'::timestamptz
from messages welcome
join conversations c on c.id = welcome.conversation_id and c.kind = 'direct'
where cp.conversation_id = welcome.conversation_id
  and cp.user_id = welcome.sender_user_id
  and welcome.suppress_notification
  and welcome.body like 'Hey, thanks for joining TEMPO! I''m Nikita,%'
  and not exists (
    select 1
    from messages reply
    where reply.conversation_id = welcome.conversation_id
      and reply.sender_user_id <> welcome.sender_user_id
  );

revoke execute on function hide_nikita_welcome_for_sender() from public, anon, authenticated;
