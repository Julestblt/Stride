begin;

create extension if not exists pgtap with schema extensions;

select plan(61);

insert into auth.users (id, aud, role, email)
values
  ('a0000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'a@example.com'),
  ('b0000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'b@example.com');

create function pg_temp.act_as(p_user uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select ok(rowsecurity, tablename || ' has RLS enabled')
from pg_tables
where schemaname = 'public'
  and tablename in ('onboarding_progress', 'athlete_profiles', 'athlete_goals', 'athlete_races');

set local role anon;
select throws_ok('select * from public.onboarding_progress', '42501', null, 'anon cannot read progress');
select throws_ok('select * from public.athlete_profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.athlete_goals', '42501', null, 'anon cannot read goals');
select throws_ok('select * from public.athlete_races', '42501', null, 'anon cannot read races');
select throws_ok(
  $$select public.complete_onboarding_step('welcome', 1)$$, '42501', null,
  'anon cannot complete steps'
);
reset role;

select pg_temp.act_as('b0000000-0000-4000-8000-00000000000b');
insert into public.onboarding_progress (user_id) values ('b0000000-0000-4000-8000-00000000000b');
insert into public.athlete_profiles (user_id, first_name) values ('b0000000-0000-4000-8000-00000000000b', 'Bea');
insert into public.athlete_goals (user_id, focus) values ('b0000000-0000-4000-8000-00000000000b', 'trail');
insert into public.athlete_races (id, user_id, name) values
  ('b1000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-00000000000b', 'Bea race');
reset role;

select pg_temp.act_as('a0000000-0000-4000-8000-00000000000a');

select lives_ok(
  $$insert into public.onboarding_progress (user_id) values ('a0000000-0000-4000-8000-00000000000a')$$,
  'athlete creates their own progress'
);
select throws_ok(
  $$insert into public.onboarding_progress (user_id) values ('b0000000-0000-4000-8000-00000000000b')$$,
  '42501', null, 'athlete cannot create progress for another athlete'
);
select throws_ok(
  $$insert into public.athlete_profiles (user_id) values ('b0000000-0000-4000-8000-00000000000b')$$,
  '42501', null, 'athlete cannot create a profile for another athlete'
);
select throws_ok(
  $$insert into public.athlete_races (user_id, name) values ('b0000000-0000-4000-8000-00000000000b', 'x')$$,
  '42501', null, 'athlete cannot create a race for another athlete'
);

select is((select count(*) from public.onboarding_progress)::int, 1, 'athlete sees only their progress');
select is((select count(*) from public.athlete_profiles)::int, 0, 'athlete cannot see another profile');
select is((select count(*) from public.athlete_goals)::int, 0, 'athlete cannot see another goal');
select is((select count(*) from public.athlete_races)::int, 0, 'athlete cannot see another race');

update public.athlete_profiles set first_name = 'Changed' where user_id = 'b0000000-0000-4000-8000-00000000000b';
update public.athlete_goals set focus = 'faster' where user_id = 'b0000000-0000-4000-8000-00000000000b';
select throws_ok(
  $$update public.onboarding_progress set current_step = 'profile'$$,
  '42501', null, 'athlete cannot change current_step directly'
);
select throws_ok(
  $$select public.set_onboarding_current_step('profile', 1)$$,
  'PT422', 'prerequisites_incomplete', 'navigation RPC cannot skip locked steps'
);
delete from public.athlete_races where id = 'b1000000-0000-4000-8000-00000000000b';

select throws_ok(
  $$update public.onboarding_progress set about_completed_at = now()$$,
  '42501', null, 'athlete cannot set step completion directly'
);
select throws_ok(
  $$update public.onboarding_progress set completed_at = now()$$,
  '42501', null, 'athlete cannot set onboarding completion directly'
);
select throws_ok(
  $$select public.complete_onboarding_step_server(
    'a0000000-0000-4000-8000-00000000000a', 'garmin', 1
  )$$,
  '42501', null, 'authenticated client cannot call server completion RPC'
);
select throws_ok(
  $$update public.athlete_profiles set user_id = 'b0000000-0000-4000-8000-00000000000b'$$,
  '42501', null, 'athlete cannot reassign ownership'
);
select throws_ok(
  $$delete from public.onboarding_progress$$, '42501', null, 'athlete cannot delete progress'
);

insert into public.athlete_profiles (user_id, first_name)
values ('a0000000-0000-4000-8000-00000000000a', 'Alex');
select throws_ok(
  $$update public.athlete_profiles set sex = 'other'$$, '23514', null, 'sex is constrained'
);
select throws_ok(
  $$update public.athlete_profiles set available_weekdays = '{1,8}'$$, '23514', null,
  'weekdays are ISO days'
);
select throws_ok(
  $$update public.athlete_profiles set weekday_session_minutes = 50$$, '23514', null,
  'session duration uses offered choices'
);
select throws_ok(
  $$update public.athlete_profiles set training_access = '{pool}'$$, '23514', null,
  'training access uses offered choices'
);
select throws_ok(
  $$update public.athlete_profiles set value_sources = '[]'$$, '23514', null,
  'value sources is an object'
);

update public.athlete_profiles set first_name = 'Alexis';
select is((select revision from public.athlete_profiles), 2, 'update advances the revision');
select ok(
  (select updated_at >= created_at from public.athlete_profiles), 'update refreshes updated_at'
);
update public.athlete_profiles set first_name = 'Stale' where revision = 1;
select is((select first_name from public.athlete_profiles), 'Alexis', 'stale revision update changes nothing');

select throws_ok(
  $$select public.complete_onboarding_step('garmin', 1)$$, 'PT403', 'server_validation_required',
  'Garmin completion always requires server validation'
);
select throws_ok(
  $$select public.complete_onboarding_step('welcome', 7)$$, 'PT409', 'revision_conflict',
  'stale revision is rejected'
);
select throws_ok(
  $$select public.complete_onboarding_step('finish', 1)$$, 'PT400', 'unknown_step',
  'unknown steps are rejected'
);
select throws_ok(
  $$select public.complete_onboarding_step(null, 1)$$, 'PT400', 'unknown_step',
  'null step names are rejected'
);
select throws_ok(
  $$select public.complete_onboarding_step('welcome', null)$$, 'PT409', 'revision_conflict',
  'null revisions are rejected'
);
select is(
  (select current_step from public.complete_onboarding_step('welcome', 1)), 'garmin',
  'welcome completes and advances'
);
select throws_ok(
  $$select public.complete_onboarding_step('garmin', 2)$$, 'PT403', 'server_validation_required',
  'authenticated client cannot forge a Garmin connection'
);
select throws_ok(
  $$select public.complete_onboarding_step('history', 2)$$,
  'PT422', 'prerequisites_incomplete', 'history remains blocked until server verifies Garmin'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000000","role":"service_role"}',
  true
);
set local role service_role;
select throws_ok(
  $$select public.complete_onboarding_step_server(
    'a0000000-0000-4000-8000-00000000000a', 'profile', 2
  )$$,
  'PT422', 'prerequisites_incomplete', 'server cannot complete profile before goals and history'
);
select is(
  (select current_step from public.complete_onboarding_step_server(
    'a0000000-0000-4000-8000-00000000000a', 'garmin', 2
  )), 'history', 'server completion records Garmin after live validation'
);
reset role;
select pg_temp.act_as('a0000000-0000-4000-8000-00000000000a');

select throws_ok(
  $$select public.complete_onboarding_step('about', 3)$$, 'PT422', 'step_data_incomplete',
  'about requires persisted profile data'
);

update public.athlete_profiles set
  birth_date = '1991-06-14', sex = 'male', height_cm = 178, weight_kg = 68,
  primary_terrain = 'trail', available_weekdays = '{2,3,4,6,7}', long_run_day = 'sunday',
  weekday_session_minutes = 60, training_access = '{hills,gym}',
  value_sources = '{"weight_kg":{"source":"garmin","observed_on":"2026-10-06"}}';
select is(
  (select current_step from public.complete_onboarding_step('about', 3)), 'goals',
  'about completes with persisted data before history'
);
select throws_ok(
  $$select public.complete_onboarding_step('goals', 4)$$, 'PT422', 'step_data_incomplete',
  'goals require a goal focus'
);
insert into public.athlete_goals (user_id, focus) values ('a0000000-0000-4000-8000-00000000000a', 'ultra_trail');
insert into public.athlete_races (user_id, name) values ('a0000000-0000-4000-8000-00000000000a', 'EcoTrail');
select throws_ok(
  $$select public.complete_onboarding_step('goals', 4)$$, 'PT422', 'step_data_incomplete',
  'incomplete races block goals'
);
update public.athlete_races set race_date = '2027-03-20', distance_km = 120, elevation_gain_m = 2000;
select is(
  (select current_step from public.complete_onboarding_step('goals', 4)), 'profile',
  'goals complete with a valid race'
);
select throws_ok(
  $$select public.complete_onboarding_step('profile', 5)$$, 'PT403', 'server_validation_required',
  'authenticated client cannot call final profile completion'
);
select isnt(
  (select history_completed_at from public.complete_onboarding_step('history', 5)), null,
  'history completes without waiting for import'
);
select throws_ok(
  $$select public.complete_onboarding_step('profile', 6)$$, 'PT403', 'server_validation_required',
  'authenticated client cannot complete onboarding through direct RPC'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000000","role":"service_role"}',
  true
);
set local role service_role;
select isnt(
  (select completed_at from public.complete_onboarding_step_server(
    'a0000000-0000-4000-8000-00000000000a', 'profile', 6
  )), null, 'server completes final review after Garmin validation'
);
reset role;
select pg_temp.act_as('a0000000-0000-4000-8000-00000000000a');
select is(
  (select revision from public.onboarding_progress), 7, 'every completion advances the revision'
);

select is(
  (select welcome_completed_at from public.onboarding_progress),
  (select welcome_completed_at from public.complete_onboarding_step('welcome', 7)),
  'completing a step again keeps its first completion time'
);
select lives_ok(
  $$select public.set_onboarding_current_step('about', 8)$$,
  'athlete can navigate back through the guarded progression RPC'
);
select throws_ok(
  $$select public.set_onboarding_current_step('welcome', 6)$$,
  'PT409', 'revision_conflict', 'navigation RPC rejects stale revisions'
);
select throws_ok(
  $$select public.set_onboarding_current_step('profile', null)$$,
  'PT409', 'revision_conflict', 'navigation RPC rejects a null revision'
);
select lives_ok($$delete from public.athlete_races$$, 'athlete can delete their own race');

reset role;

select is(
  (select first_name from public.athlete_profiles where user_id = 'b0000000-0000-4000-8000-00000000000b'),
  'Bea', 'another athlete profile was not changed'
);
select is(
  (select current_step from public.onboarding_progress where user_id = 'b0000000-0000-4000-8000-00000000000b'),
  'welcome', 'another athlete progress was not changed'
);
select is(
  (select count(*) from public.athlete_races where user_id = 'b0000000-0000-4000-8000-00000000000b')::int,
  1, 'another athlete race was not deleted'
);

delete from auth.users where id = 'a0000000-0000-4000-8000-00000000000a';
select is(
  (select count(*) from public.onboarding_progress where user_id = 'a0000000-0000-4000-8000-00000000000a')::int
  + (select count(*) from public.athlete_profiles where user_id = 'a0000000-0000-4000-8000-00000000000a')::int
  + (select count(*) from public.athlete_goals where user_id = 'a0000000-0000-4000-8000-00000000000a')::int,
  0, 'deleting the account removes onboarding data'
);

select * from finish();

rollback;
