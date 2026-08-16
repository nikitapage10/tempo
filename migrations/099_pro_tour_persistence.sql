-- TEMPO migration 099: durable Pro tour choice.
-- Additive and rerunnable. Run after 098.
--
-- Artist introduction completion and the Pro page-guide decision are different
-- choices, especially for dual accounts. Persist them independently so signing
-- in, switching workspaces, or using another device cannot reopen the prompt.

alter table member_onboarding
  add column if not exists pro_tour_choice text;

alter table member_onboarding
  drop constraint if exists member_onboarding_pro_tour_choice_check;
alter table member_onboarding
  add constraint member_onboarding_pro_tour_choice_check
  check (pro_tour_choice is null or pro_tour_choice in ('guides', 'skip_all'));

-- Preserve choices made by Pro accounts before this dedicated field existed.
-- A complete set of skipped Pro ids means Skip all; any prior Pro guide activity
-- means Guides. The old shared main-tour marker is the final compatibility hint.
update member_onboarding
set pro_tour_choice = case
  when page_tours_skipped @> array[
    'pro-today', 'pro-calendar', 'pro-projects', 'pro-tasks', 'pro-team',
    'pro-profile', 'pro-social', 'pro-scenes', 'pro-settings'
  ]::text[] then 'skip_all'
  else 'guides'
end
where member_role = 'team_member'
  and pro_tour_choice is null
  and (
    main_tour_completed_at is not null
    or page_tours_completed && array[
      'pro-today', 'pro-calendar', 'pro-projects', 'pro-tasks', 'pro-team',
      'pro-profile', 'pro-social', 'pro-scenes', 'pro-settings'
    ]::text[]
    or page_tours_skipped && array[
      'pro-today', 'pro-calendar', 'pro-projects', 'pro-tasks', 'pro-team',
      'pro-profile', 'pro-social', 'pro-scenes', 'pro-settings'
    ]::text[]
  );

insert into schema_migrations (version, name, checksum, applied_by)
values (99, '099_pro_tour_persistence', 'initial', 'migration-self-register')
on conflict (version) do nothing;
