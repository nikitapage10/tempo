-- Sessions V2: let authenticated room members read and add markers on the
-- focused song without granting any wider catalog access.

drop policy if exists session_members_read_focused_comments on comments;
create policy session_members_read_focused_comments on comments
for select to authenticated
using (
  exists (
    select 1
    from session_rooms sr
    join session_members sm on sm.session_room_id = sr.id
    where sr.track_id = comments.track_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
  )
);

drop policy if exists session_members_add_focused_comments on comments;
create policy session_members_add_focused_comments on comments
for insert to authenticated
with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from session_rooms sr
    join session_members sm on sm.session_room_id = sr.id
    join versions v on v.track_id = sr.track_id
    where sr.track_id = comments.track_id
      and v.id = comments.version_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
  )
);
