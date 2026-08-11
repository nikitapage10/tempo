-- Let artists remove their own home-feed posts with a verifiable result.
-- A security-definer function is required because the normal SELECT policy
-- intentionally hides a row as soon as deleted_at is populated, which makes
-- UPDATE ... RETURNING unable to confirm the soft delete to the client.

create or replace function delete_own_social_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_removed integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update posts
  set deleted_at = now(), updated_at = now()
  where id = p_post_id
    and author_user_id = auth.uid()
    and scene_id is null
    and deleted_at is null;

  get diagnostics v_removed = row_count;
  return v_removed > 0;
end;
$$;

revoke execute on function delete_own_social_post(uuid) from public, anon;
grant execute on function delete_own_social_post(uuid) to authenticated;
