-- TEMPO migration 040 — realtime inbox signals
-- Run after migration 039. Message contents remain protected by their existing
-- RLS/API boundaries; realtime carries only each user's own notification rows.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
