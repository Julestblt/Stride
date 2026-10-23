begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, aud, role, email) values
  ('a9000000-0000-4000-8000-0000000000a9', 'authenticated', 'authenticated', 'push-a@example.com'),
  ('b9000000-0000-4000-8000-0000000000b9', 'authenticated', 'authenticated', 'push-b@example.com'),
  ('c9000000-0000-4000-8000-0000000000c9', 'authenticated', 'authenticated', 'push-c@example.com'),
  ('d9000000-0000-4000-8000-0000000000d9', 'authenticated', 'authenticated', 'push-d@example.com');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.deliveries(p_user uuid, p_kind text) returns integer language sql as $$
  select count(*)::integer from public.push_deliveries where user_id = p_user and kind = p_kind;
$$;

create function pg_temp.local_time(p_time time) returns timestamptz language sql as $$
  select ((now() at time zone 'Europe/Paris')::date + p_time) at time zone 'Europe/Paris';
$$;

select ok(
  (select bool_and(rowsecurity) from pg_tables
    where schemaname = 'public'
      and tablename in ('push_subscriptions', 'push_preferences', 'push_deliveries')),
  'push tables have RLS enabled'
);

select ok(
  not has_table_privilege('authenticated', 'public.push_deliveries', 'select')
    and not has_table_privilege('anon', 'public.push_deliveries', 'select')
    and not has_table_privilege('anon', 'public.push_subscriptions', 'select')
    and not has_table_privilege('authenticated', 'public.push_subscriptions', 'insert')
    and not has_table_privilege('authenticated', 'public.push_subscriptions', 'update'),
  'clients cannot read deliveries or write devices directly'
);

select ok(
  not has_function_privilege('authenticated', 'private.push_tick(timestamptz)', 'execute')
    and not has_function_privilege('anon', 'private.push_tick(timestamptz)', 'execute')
    and not has_function_privilege('authenticated', 'private.reconcile_garmin_notifications_for(uuid, jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.register_push_subscription(text, text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.register_push_subscription(text, text, text, text)', 'execute'),
  'only athletes register devices and only the scheduler runs the tick'
);

select is(
  (select count(*)::integer from cron.job where jobname = 'stride-push-tick' and schedule = '* * * * *'),
  1, 'the push tick runs every minute'
);

select pg_temp.act_as('a9000000-0000-4000-8000-0000000000a9');
select isnt(
  public.register_push_subscription('https://fcm.googleapis.com/fcm/send/a', 'p256dh-a', 'auth-a', 'iPhone'),
  null, 'an athlete registers a device'
);
select is(
  public.register_push_subscription('https://fcm.googleapis.com/fcm/send/a', 'p256dh-a2', 'auth-a2', 'iPhone'),
  (select id from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/a'),
  'registering the same endpoint again keeps one device'
);
select throws_ok(
  $$select public.register_push_subscription('https://10.0.0.1/push', 'k', 'a', null)$$,
  '22023', 'Unsupported push endpoint', 'only browser push services are accepted'
);
select throws_ok(
  $$select public.register_push_subscription('https://push.apple.com.example.com/x', 'k', 'a', null)$$,
  '22023', 'Unsupported push endpoint', 'a look-alike host is rejected'
);
reset role;
select pg_temp.act_as('c9000000-0000-4000-8000-0000000000c9');
select public.register_push_subscription('https://fcm.googleapis.com/fcm/send/c', 'p256dh-c', 'auth-c', null);
reset role;
select pg_temp.act_as('d9000000-0000-4000-8000-0000000000d9');
select public.register_push_subscription('https://fcm.googleapis.com/fcm/send/d', 'p256dh-d', 'auth-d', null);
reset role;

select pg_temp.act_as('b9000000-0000-4000-8000-0000000000b9');
select is(
  (select count(*)::integer from public.push_subscriptions), 0,
  'another athlete cannot see the device'
);
select throws_ok(
  $$insert into public.push_preferences (user_id) values ('a9000000-0000-4000-8000-0000000000a9')$$,
  '42501', null, 'another athlete cannot write the preferences'
);
select throws_ok(
  'select * from public.push_deliveries', '42501', null,
  'athletes cannot read deliveries'
);
select public.register_push_subscription('https://web.push.apple.com/b', 'p256dh-b', 'auth-b', null);
reset role;

select set_config('request.jwt.claims', '', true);
set local role authenticated;
select throws_ok(
  'select public.reconcile_garmin_notifications()', '42501', 'Not authenticated',
  'the Garmin reconcile RPC still requires a session'
);
reset role;

insert into public.plan_proposals (id, user_id, plan_id, base_version, scope, origin, requested_by,
  status, title, summary, operations)
values ('a9000000-0000-4000-8000-0000000000e1', 'a9000000-0000-4000-8000-0000000000a9', null, null,
  'new_plan', 'training', 'athlete', 'ready', 'Semaine allégée', null, '[]');

select private.push_tick();
select is(
  (select count(*)::integer from public.push_deliveries), 0,
  'the tick does nothing while the dispatch secrets are missing'
);

select vault.create_secret('https://stride.example.com/api/push/dispatch', 'push_dispatch_url');
select vault.create_secret('test-dispatch-secret', 'push_dispatch_secret');

select private.push_tick();
select is(
  (select status || '/' || attempts || '/' || (request_id is not null) from public.push_deliveries
    where user_id = 'a9000000-0000-4000-8000-0000000000a9' and kind = 'plan_proposal'),
  'sent/1/true', 'a new proposal is pushed once to the athlete device'
);
select is(
  pg_temp.deliveries('b9000000-0000-4000-8000-0000000000b9', 'plan_proposal'), 0,
  'other athletes get nothing'
);

select private.push_tick();
select is(
  pg_temp.deliveries('a9000000-0000-4000-8000-0000000000a9', 'plan_proposal'), 1,
  'the same notification is not pushed twice'
);

update public.notifications set occurred_at = clock_timestamp()
  where dedupe_key = 'plan_proposal:a9000000-0000-4000-8000-0000000000e1';
select private.push_tick();
select is(
  pg_temp.deliveries('a9000000-0000-4000-8000-0000000000a9', 'plan_proposal'), 2,
  'a re-notified notification is pushed again'
);

insert into public.push_preferences (user_id, plan_staff)
values ('a9000000-0000-4000-8000-0000000000a9', false);
insert into public.plan_proposals (id, user_id, plan_id, base_version, scope, origin, requested_by,
  status, title, summary, operations)
values ('a9000000-0000-4000-8000-0000000000e2', 'a9000000-0000-4000-8000-0000000000a9', null, null,
  'new_plan', 'training', 'athlete', 'ready', 'Bloc seuil', null, '[]');
select private.push_tick();
select is(
  pg_temp.deliveries('a9000000-0000-4000-8000-0000000000a9', 'plan_proposal'), 2,
  'a category turned off is not pushed'
);

insert into public.training_plans (id, user_id, title, starts_on, ends_on, active_version, time_zone)
values
  ('a9000000-0000-4000-8000-0000000000d1', 'a9000000-0000-4000-8000-0000000000a9',
   'Plan A', current_date - 7, current_date + 60, 1, 'Europe/Paris'),
  ('b9000000-0000-4000-8000-0000000000d1', 'b9000000-0000-4000-8000-0000000000b9',
   'Plan B', current_date - 7, current_date + 60, 1, 'Europe/Paris');
insert into public.plan_versions (plan_id, version, user_id, created_by, effective_from, confidence, content_hash)
values
  ('a9000000-0000-4000-8000-0000000000d1', 1, 'a9000000-0000-4000-8000-0000000000a9',
   'coach', current_date, '{"level": "normal", "reasons": []}', 'hash'),
  ('b9000000-0000-4000-8000-0000000000d1', 1, 'b9000000-0000-4000-8000-0000000000b9',
   'coach', current_date, '{"level": "normal", "reasons": []}', 'hash');
insert into public.plan_sessions (
  id, plan_id, user_id, session_key, valid_from_version, scheduled_on, sport, kind, title, purpose,
  is_key, priority, targets, structure, origin
) values
  ('a9000000-0000-4000-8000-0000000000f1', 'a9000000-0000-4000-8000-0000000000d1',
   'a9000000-0000-4000-8000-0000000000a9', 's-1', 1, (now() at time zone 'Europe/Paris')::date,
   'run', 'easy', 'Footing', 'Objectif', false, 'normal',
   '{"durationSeconds": 3000, "distanceMeters": 8000, "elevationGainMeters": null}', '[]', 'template'),
  ('a9000000-0000-4000-8000-0000000000f2', 'a9000000-0000-4000-8000-0000000000d1',
   'a9000000-0000-4000-8000-0000000000a9', 'r-1', 1, (now() at time zone 'Europe/Paris')::date,
   'rest', 'rest', 'Repos', 'Objectif', false, 'normal', '{}', '[]', 'template'),
  ('b9000000-0000-4000-8000-0000000000f1', 'b9000000-0000-4000-8000-0000000000d1',
   'b9000000-0000-4000-8000-0000000000b9', 'm-1', 1, (now() at time zone 'Europe/Paris')::date,
   'strength', 'mobility', 'Mobilité', 'Objectif', false, 'normal', '{}', '[]', 'template');
insert into public.session_activity_matches (
  user_id, plan_id, session_key, session_revision_id, activity_id, method, confidence, status
) values (
  'b9000000-0000-4000-8000-0000000000b9', 'b9000000-0000-4000-8000-0000000000d1', 'm-1',
  'b9000000-0000-4000-8000-0000000000f1', null, 'athlete', 1, 'checked_in'
);

insert into public.training_plans (id, user_id, title, starts_on, ends_on, active_version, time_zone)
values ('c9000000-0000-4000-8000-0000000000d1', 'c9000000-0000-4000-8000-0000000000c9',
  'Plan C', current_date - 7, current_date + 60, 1, 'Foo/Bar');
insert into public.plan_versions (plan_id, version, user_id, created_by, effective_from, confidence, content_hash)
values ('c9000000-0000-4000-8000-0000000000d1', 1, 'c9000000-0000-4000-8000-0000000000c9',
  'coach', current_date, '{"level": "normal", "reasons": []}', 'hash');
insert into public.plan_sessions (
  id, plan_id, user_id, session_key, valid_from_version, scheduled_on, sport, kind, title, purpose,
  is_key, priority, targets, structure, origin
) values (
  'c9000000-0000-4000-8000-0000000000f1', 'c9000000-0000-4000-8000-0000000000d1',
  'c9000000-0000-4000-8000-0000000000c9', 's-1', 1, (now() at time zone 'Europe/Paris')::date,
  'run', 'easy', 'Footing', 'Objectif', false, 'normal', '{}', '[]', 'template'
);

select private.push_tick(pg_temp.local_time('06:30'));
select is(
  pg_temp.deliveries('a9000000-0000-4000-8000-0000000000a9', 'session_reminder'), 0,
  'no reminder before 07:00 in the plan time zone'
);

select lives_ok(
  $$select private.push_tick(pg_temp.local_time('07:05'))$$,
  'a plan with an unknown time zone does not break the tick'
);
select is(
  (select string_agg(payload -> 'sessions' -> 0 ->> 'title' || '/' || jsonb_array_length(payload -> 'sessions'), ',')
    from public.push_deliveries
    where user_id = 'a9000000-0000-4000-8000-0000000000a9' and kind = 'session_reminder'),
  'Footing/1', 'the morning reminder lists the planned sessions, not the rest day'
);

select private.push_tick(pg_temp.local_time('09:00'));
select is(
  pg_temp.deliveries('a9000000-0000-4000-8000-0000000000a9', 'session_reminder'), 1,
  'the reminder is sent once per day'
);
select is(
  pg_temp.deliveries('b9000000-0000-4000-8000-0000000000b9', 'session_reminder'), 0,
  'no reminder once the session is checked in'
);

insert into public.training_plans (id, user_id, title, starts_on, ends_on, active_version, time_zone)
values ('d9000000-0000-4000-8000-0000000000d1', 'd9000000-0000-4000-8000-0000000000d9',
  'Plan D', current_date - 7, current_date + 60, 1, 'Europe/Paris');
insert into public.plan_versions (plan_id, version, user_id, created_by, effective_from, confidence, content_hash)
values ('d9000000-0000-4000-8000-0000000000d1', 1, 'd9000000-0000-4000-8000-0000000000d9',
  'coach', current_date, '{"level": "normal", "reasons": []}', 'hash');
insert into public.plan_sessions (
  id, plan_id, user_id, session_key, valid_from_version, scheduled_on, sport, kind, title, purpose,
  is_key, priority, targets, structure, origin
) values (
  'd9000000-0000-4000-8000-0000000000f1', 'd9000000-0000-4000-8000-0000000000d1',
  'd9000000-0000-4000-8000-0000000000d9', 's-1', 1, (now() at time zone 'Europe/Paris')::date,
  'run', 'easy', 'Footing', 'Objectif', false, 'normal', '{}', '[]', 'template'
);
select private.push_tick(pg_temp.local_time('12:30'));
select is(
  pg_temp.deliveries('d9000000-0000-4000-8000-0000000000d9', 'session_reminder'), 0,
  'no reminder after noon'
);

select * from finish();
rollback;
