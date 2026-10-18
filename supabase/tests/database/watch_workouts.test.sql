begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, aud, role, email) values
  ('a1000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'a1@example.com'),
  ('b2000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'b2@example.com');
insert into public.athlete_profiles (user_id) values
  ('a1000000-0000-4000-8000-0000000000a1'),
  ('b2000000-0000-4000-8000-0000000000b2');
insert into public.provider_connections (id, user_id, provider, status) values
  ('c1000000-0000-4000-8000-0000000000c1', 'a1000000-0000-4000-8000-0000000000a1', 'garmin', 'connected'),
  ('c2000000-0000-4000-8000-0000000000c2', 'b2000000-0000-4000-8000-0000000000b2', 'garmin', 'connected');
insert into public.provider_workouts (
  connection_id, user_id, external_key, scheduled_on, status, content_hash,
  provider_workout_id, sent_at
) values
  ('c1000000-0000-4000-8000-0000000000c1', 'a1000000-0000-4000-8000-0000000000a1',
   'plan:s1', '2026-10-20', 'sent', repeat('a', 64), 101, now()),
  ('c2000000-0000-4000-8000-0000000000c2', 'b2000000-0000-4000-8000-0000000000b2',
   'plan:s1', '2026-10-20', 'sent', repeat('b', 64), 202, now());

create function pg_temp.act_as(p_user uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('a1000000-0000-4000-8000-0000000000a1');
select is(
  (select watch_workouts_enabled from public.athlete_profiles),
  false, 'sending to the watch is off by default'
);
select lives_ok(
  $$update public.athlete_profiles
    set watch_workouts_enabled = true, watch_workouts_synced_key = 'plan:3:2026-10-18',
        watch_workouts_synced_at = now()
    where user_id = 'a1000000-0000-4000-8000-0000000000a1'$$,
  'athlete turns sending on and records the last sync'
);
select is(
  (select array_agg(provider_workout_id) from public.provider_workouts),
  array[101::bigint], 'athlete reads only their own pushed workouts'
);
select throws_ok(
  $$insert into public.provider_workouts (
      connection_id, user_id, external_key, scheduled_on, status, content_hash)
    values ('c1000000-0000-4000-8000-0000000000c1', 'a1000000-0000-4000-8000-0000000000a1',
            'plan:s2', '2026-10-21', 'failed', repeat('c', 64))$$,
  '42501', null, 'athlete cannot write pushed workouts'
);
update public.athlete_profiles set watch_workouts_enabled = true
  where user_id = 'b2000000-0000-4000-8000-0000000000b2';
reset role;
select is(
  (select watch_workouts_enabled from public.athlete_profiles
   where user_id = 'b2000000-0000-4000-8000-0000000000b2'),
  false, 'athlete cannot change another athlete''s setting'
);
select throws_ok(
  $$update public.athlete_profiles set watch_workouts_synced_key = repeat('x', 121)
    where user_id = 'a1000000-0000-4000-8000-0000000000a1'$$,
  '23514', null, 'sync key length is bounded'
);

select * from finish();
rollback;
