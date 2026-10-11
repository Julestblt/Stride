begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, aud, role, email) values
  ('c0000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'race-c@example.com'),
  ('d0000000-0000-4000-8000-00000000000d', 'authenticated', 'authenticated', 'race-d@example.com');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select ok(rowsecurity, tablename || ' has RLS enabled')
from pg_tables
where schemaname = 'public'
  and tablename in ('race_plans', 'race_courses', 'race_waypoints', 'race_checklist_items');

set local role anon;
select throws_ok('select * from public.race_plans', '42501', null, 'anonymous user cannot read plans');
select throws_ok('select * from public.race_courses', '42501', null, 'anonymous user cannot read courses');
select throws_ok('select * from public.race_waypoints', '42501', null, 'anonymous user cannot read waypoints');
select throws_ok('select * from public.race_checklist_items', '42501', null, 'anonymous user cannot read checklists');
reset role;

select pg_temp.act_as('c0000000-0000-4000-8000-00000000000c');
insert into public.athlete_races (id, user_id, name) values
  ('c1000000-0000-4000-8000-00000000000c', 'c0000000-0000-4000-8000-00000000000c', 'Course C');
insert into public.race_plans (race_id, user_id) values
  ('c1000000-0000-4000-8000-00000000000c', 'c0000000-0000-4000-8000-00000000000c');
insert into public.race_waypoints (race_id, user_id, kind, name, distance_m) values
  ('c1000000-0000-4000-8000-00000000000c', 'c0000000-0000-4000-8000-00000000000c', 'aid', 'Ravito', 1000);
insert into public.race_checklist_items (race_id, user_id, list, label) values
  ('c1000000-0000-4000-8000-00000000000c', 'c0000000-0000-4000-8000-00000000000c', 'gear_mandatory', 'Lampe');
select is((select count(*)::int from public.race_plans), 1, 'owner reads plan');
select is((select count(*)::int from public.race_waypoints), 1, 'owner reads waypoints');
select is((select count(*)::int from public.race_checklist_items), 1, 'owner reads checklist');
insert into public.race_waypoints (race_id, user_id, kind, name, distance_m, source) values
  ('c1000000-0000-4000-8000-00000000000c', 'c0000000-0000-4000-8000-00000000000c', 'summit', 'Sommet GPX', 2000, 'gpx');
update public.race_plans set walk_grade_percent = 12;
select public.replace_race_roadbook(
  'c1000000-0000-4000-8000-00000000000c',
  '[{"kind":"aid","name":"Ravito PDF","distance_m":3000,"cutoff_time":null,"services":["water"],"needs_review":true}]'::jsonb,
  '{"source":"roadbook.pdf"}'::jsonb
);
select is((select walk_grade_percent from public.race_plans), 12, 'roadbook import preserves plan settings');
select is((select count(*)::int from public.race_waypoints where source = 'gpx'), 1, 'roadbook import preserves unmatched GPX points');
select is((select count(*)::int from public.race_waypoints where source = 'roadbook'), 1, 'roadbook import adds imported points');
select throws_ok(
  $$select public.replace_race_roadbook(
    'c1000000-0000-4000-8000-00000000000c',
    '[{"kind":"invalid","name":"Mauvais point","distance_m":4000,"cutoff_time":null,"services":[],"needs_review":true}]'::jsonb,
    '{}'::jsonb
  )$$,
  '23514', null, 'invalid import fails atomically'
);
select is((select name from public.race_waypoints where source = 'roadbook'), 'Ravito PDF', 'failed import keeps earlier points');
select is(
  public.replace_race_course(
    'c1000000-0000-4000-8000-00000000000c', 'gpx', 'test.gpx',
    'Europe/Paris', 1000, 10,
    '[[48.8,2.3,100],[48.81,2.31,110]]'::jsonb, '[]'::jsonb,
    null, 10, 10
  ), 2, 'course import adds start and finish'
);
select is((select distance_m::int from public.race_courses), 1000, 'course is stored');
select throws_ok(
  $$select public.replace_race_course(
    'c1000000-0000-4000-8000-00000000000c', 'gpx', 'bad.gpx',
    'Europe/Paris', 2000, 10,
    '[[48.8,2.3,100],[48.81,2.31,110]]'::jsonb,
    '[{"kind":"invalid","name":"Bad","distance_m":500,"todo":null,"needs_review":false}]'::jsonb,
    null, 20, 20
  )$$,
  '23514', null, 'invalid course waypoint rolls back replacement'
);
select is((select distance_m::int from public.race_courses), 1000, 'failed replacement retains earlier course');
reset role;

select pg_temp.act_as('d0000000-0000-4000-8000-00000000000d');
select is((select count(*)::int from public.race_plans), 0, 'other athlete cannot read plan');
select throws_ok(
  $$insert into public.race_waypoints (race_id, user_id, kind, name, distance_m)
    values ('c1000000-0000-4000-8000-00000000000c',
      'd0000000-0000-4000-8000-00000000000d', 'aid', 'Intrusion', 1000)$$,
  '42501', null, 'other athlete cannot add a waypoint to this race'
);
reset role;

select * from finish();
rollback;
