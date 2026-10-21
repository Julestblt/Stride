begin;

create extension if not exists pgtap with schema extensions;
select plan(35);

insert into auth.users (id, aud, role, email) values
  ('a8000000-0000-4000-8000-0000000000a8', 'authenticated', 'authenticated', 'garmin-notif-a@example.com'),
  ('b8000000-0000-4000-8000-0000000000b8', 'authenticated', 'authenticated', 'garmin-notif-b@example.com');

insert into public.provider_connections (id, user_id, provider, status, last_error_code, updated_at) values
  ('c8000000-0000-4000-8000-0000000000a8', 'a8000000-0000-4000-8000-0000000000a8', 'garmin', 'connected', null, now()),
  ('c8000000-0000-4000-8000-0000000000b8', 'b8000000-0000-4000-8000-0000000000b8', 'garmin', 'reconnect_required', null, now());

insert into public.provider_activities (
  id, user_id, connection_id, provider, provider_activity_id, activity_name, activity_type,
  started_at, distance_meters, duration_seconds, imported_at
) values
  ('e8000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-0000000000a8',
   'c8000000-0000-4000-8000-0000000000a8', 'garmin', 'g-1', 'Footing · 50’', 'running',
   now() - interval '3 hours', 8320, 3010, now() - interval '2 hours'),
  ('e8000000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-0000000000a8',
   'c8000000-0000-4000-8000-0000000000a8', 'garmin', 'g-2', 'Sortie trail', 'trail_running',
   now() - interval '1 day', 15000, 6000, now() - interval '20 hours'),
  ('e8000000-0000-4000-8000-000000000003', 'a8000000-0000-4000-8000-0000000000a8',
   'c8000000-0000-4000-8000-0000000000a8', 'garmin', 'g-3', 'Ancienne sortie', 'running',
   now() - interval '10 days', 10000, 3600, now() - interval '1 hour'),
  ('e8000000-0000-4000-8000-000000000004', 'a8000000-0000-4000-8000-0000000000a8',
   'c8000000-0000-4000-8000-0000000000a8', 'garmin', 'g-4', 'Vélo', 'cycling',
   now() - interval '3 hours', 30000, 3600, now() - interval '2 hours'),
  ('e8000000-0000-4000-8000-000000000005', 'a8000000-0000-4000-8000-0000000000a8',
   'c8000000-0000-4000-8000-0000000000a8', 'garmin', 'g-5', 'Sortie archivée', 'running',
   now() - interval '5 hours', 6000, 2100, now() - interval '4 hours'),
  ('e8000000-0000-4000-8000-0000000000b1', 'b8000000-0000-4000-8000-0000000000b8',
   'c8000000-0000-4000-8000-0000000000b8', 'garmin', 'g-b1', 'Footing B', 'running',
   now() - interval '3 hours', 5000, 1800, now() - interval '2 hours');

insert into public.training_plans (id, user_id, title, starts_on, ends_on, active_version, time_zone)
values ('d8000000-0000-4000-8000-000000000001', 'a8000000-0000-4000-8000-0000000000a8',
  'Plan A', current_date - 7, current_date + 60, 1, 'Europe/Paris');
insert into public.plan_versions (plan_id, version, user_id, created_by, effective_from, confidence, content_hash)
values ('d8000000-0000-4000-8000-000000000001', 1, 'a8000000-0000-4000-8000-0000000000a8',
  'coach', current_date, '{"level": "normal", "reasons": []}', 'hash');
insert into public.plan_sessions (
  id, plan_id, user_id, session_key, valid_from_version, scheduled_on, sport, kind, title, purpose,
  is_key, priority, targets, structure, origin
) values
  ('f8000000-0000-4000-8000-000000000001', 'd8000000-0000-4000-8000-000000000001',
   'a8000000-0000-4000-8000-0000000000a8', 's-1', 1, current_date, 'run', 'easy', 'Footing', 'Objectif',
   false, 'normal', '{"durationSeconds": 3000, "distanceMeters": 8000, "elevationGainMeters": null}', '[]', 'template'),
  ('f8000000-0000-4000-8000-000000000002', 'd8000000-0000-4000-8000-000000000001',
   'a8000000-0000-4000-8000-0000000000a8', 's-2', 1, current_date + 2, 'run', 'threshold', 'Seuil', 'Objectif',
   true, 'high', '{"durationSeconds": 3000, "distanceMeters": 9000, "elevationGainMeters": null}', '[]', 'template');

insert into public.training_plans (id, user_id, title, starts_on, ends_on, active_version, time_zone, status)
values ('d8000000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-0000000000a8',
  'Ancien plan', current_date - 90, current_date - 10, 1, 'Europe/Paris', 'archived');
insert into public.plan_sessions (
  id, plan_id, user_id, session_key, valid_from_version, scheduled_on, sport, kind, title, purpose,
  is_key, priority, targets, structure, origin
) values
  ('f8000000-0000-4000-8000-000000000003', 'd8000000-0000-4000-8000-000000000002',
   'a8000000-0000-4000-8000-0000000000a8', 's-1', 1, current_date, 'run', 'easy', 'Footing', 'Objectif',
   false, 'normal', '{"durationSeconds": 3000, "distanceMeters": 8000, "elevationGainMeters": null}', '[]', 'template');

insert into public.session_activity_matches (
  user_id, plan_id, session_key, session_revision_id, activity_id, method, confidence, status, algorithm_version
) values
  ('a8000000-0000-4000-8000-0000000000a8', 'd8000000-0000-4000-8000-000000000001', 's-1',
   'f8000000-0000-4000-8000-000000000001', 'e8000000-0000-4000-8000-000000000001', 'auto', 0.9,
   'completed', 'v1'),
  ('a8000000-0000-4000-8000-0000000000a8', 'd8000000-0000-4000-8000-000000000002', 's-1',
   'f8000000-0000-4000-8000-000000000003', 'e8000000-0000-4000-8000-000000000005', 'auto', 0.9,
   'completed', 'v1');

insert into public.provider_workouts (
  connection_id, user_id, external_key, scheduled_on, status, content_hash, error_code
) values
  ('c8000000-0000-4000-8000-0000000000a8', 'a8000000-0000-4000-8000-0000000000a8',
   'd8000000-0000-4000-8000-000000000001:s-2', current_date + 2, 'failed', repeat('a', 64), 'unsupported_data');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.notification(p_key text) returns public.notifications language sql as $$
  select * from public.notifications
  where user_id = 'a8000000-0000-4000-8000-0000000000a8' and dedupe_key = p_key;
$$;

create function pg_temp.snapshot() returns jsonb language sql as $$
  select coalesce(jsonb_agg(to_jsonb(n) order by n.dedupe_key), '[]')
  from public.notifications n
  where n.user_id = 'a8000000-0000-4000-8000-0000000000a8';
$$;

create function pg_temp.mismatch(p_activity text) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object(
    'activityId', p_activity, 'sessionTitle', 'Footing', 'day', current_date::text,
    'garmin', 'Zegama', 'planned', 'Evo SL 3'
  ));
$$;

set local role anon;
select throws_ok(
  $$select public.reconcile_garmin_notifications(null)$$,
  '42501', null, 'anonymous users cannot reconcile'
);
reset role;

select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select lives_ok(
  $$select public.reconcile_garmin_notifications('[]')$$,
  'the athlete reconciles their Garmin notifications'
);
select is(
  (select payload ->> 'matched' || '/' || (payload ->> 'distanceMeters') || '/' || (read_at is null)
    from pg_temp.notification('garmin_activity:e8000000-0000-4000-8000-000000000001')),
  'true/8320/true', 'a fresh matched run creates an unread matched notification'
);
select is(
  (select payload ->> 'matched' || '/' || (payload ->> 'name')
    from pg_temp.notification('garmin_activity:e8000000-0000-4000-8000-000000000002')),
  'false/Sortie trail', 'a fresh run without a session is unmatched'
);
select is(
  (select count(*)::int from public.notifications
    where dedupe_key in ('garmin_activity:e8000000-0000-4000-8000-000000000003',
                         'garmin_activity:e8000000-0000-4000-8000-000000000004')),
  0, 'backfilled runs and non-running activities create nothing'
);
select is(
  (select payload ->> 'matched'
    from pg_temp.notification('garmin_activity:e8000000-0000-4000-8000-000000000005')),
  'false', 'a match from an archived plan does not count as associated'
);
select is(
  (select count(*)::int from public.notifications where kind = 'garmin_connection'),
  0, 'a connected account creates no connection notification'
);
select is(
  (select payload ->> 'status' || '/' || (payload ->> 'sessionTitle') || '/' || (resolved_at is null)
    from pg_temp.notification('watch_workout:d8000000-0000-4000-8000-000000000001:s-2:' || repeat('a', 16))),
  'failed/Seuil/true', 'a failed watch send creates an open notification'
);

select is(
  (select count(*)::int from public.notifications),
  4, 'the athlete sees only their own notifications'
);

update public.notifications set read_at = now()
  where dedupe_key = 'garmin_activity:e8000000-0000-4000-8000-000000000002';
reset role;

insert into public.session_activity_matches (
  user_id, plan_id, session_key, session_revision_id, activity_id, method, confidence, status, algorithm_version
) values (
  'a8000000-0000-4000-8000-0000000000a8', 'd8000000-0000-4000-8000-000000000001', 's-2',
  'f8000000-0000-4000-8000-000000000002', 'e8000000-0000-4000-8000-000000000002', 'athlete', 1,
  'completed', null
);
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications('[]');
select is(
  (select payload ->> 'matched' || '/' || (read_at is not null)
    from pg_temp.notification('garmin_activity:e8000000-0000-4000-8000-000000000002')),
  'true/true', 'a match found later updates the payload and keeps it read'
);

create function pg_temp.connection_as(p_status text, p_code text, p_at timestamptz) returns void
language sql as $$
  update public.provider_connections set status = p_status, last_error_code = p_code, updated_at = p_at
  where id = 'c8000000-0000-4000-8000-0000000000a8';
$$;

create function pg_temp.connections() returns text language sql as $$
  select string_agg(
    split_part(dedupe_key, ':', 3) || '=' || coalesce(resolution, 'open') || '/'
      || case when read_at is null then 'unread' else 'read' end,
    ',' order by dedupe_key)
  from public.notifications
  where user_id = 'a8000000-0000-4000-8000-0000000000a8' and kind = 'garmin_connection';
$$;

create function pg_temp.watch_key(p_hash text) returns text language sql as $$
  select 'watch_workout:d8000000-0000-4000-8000-000000000001:s-2:' || repeat(p_hash, 16);
$$;

reset role;
select pg_temp.connection_as('reconnect_required', 'reconnect_required', now() - interval '2 hours');
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
select is(
  (select payload ->> 'status' || '/' || (resolved_at is null)
    from pg_temp.notification('garmin_connection:c8000000-0000-4000-8000-0000000000a8:reconnect_required')),
  'reconnect_required/true', 'a connection needing reconnect creates an open notification'
);

update public.notifications set read_at = now() where kind = 'garmin_connection';
reset role;
select pg_temp.connection_as('reconnect_required', 'unauthorized', now() - interval '1 hour');
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
select is(
  (select (payload ->> 'errorCode') || '/' || (occurred_at = now() - interval '1 hour') || '/' || (read_at is not null)
    from pg_temp.notification('garmin_connection:c8000000-0000-4000-8000-0000000000a8:reconnect_required')),
  'unauthorized/true/true', 'an open connection notification shows the new error code and stays read'
);

reset role;
select pg_temp.connection_as('error', 'sync_failed', now() - interval '50 minutes');
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
select is(
  pg_temp.connections(),
  'error=open/unread,reconnect_required=replaced/read',
  'a failing sync replaces the earlier connection notification'
);

reset role;
select pg_temp.connection_as('rate_limited', 'rate_limited', now() - interval '40 minutes');
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
reset role;
select pg_temp.connection_as('provider_unavailable', 'provider_unavailable', now() - interval '30 minutes');
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
select is(
  pg_temp.connections(),
  'error=replaced/read,provider_unavailable=open/unread,rate_limited=replaced/read,reconnect_required=replaced/read',
  'rate limits and provider outages create their own notification and replace the previous one'
);

reset role;
select pg_temp.connection_as('expired', null, now() - interval '20 minutes');
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
select is(
  (select payload ->> 'status' || '/' || coalesce(resolution, 'open')
    from pg_temp.notification('garmin_connection:c8000000-0000-4000-8000-0000000000a8:expired')),
  'expired/open', 'an expired connection creates an open notification'
);

reset role;
select pg_temp.connection_as('connected', null, now() - interval '10 minutes');
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
select is(
  pg_temp.connections(),
  'error=replaced/read,expired=restored/read,provider_unavailable=replaced/read,rate_limited=replaced/read,reconnect_required=replaced/read',
  'a restored connection resolves the open notification as restored and read'
);

update public.notifications set read_at = now()
  where kind = 'garmin_connection';
reset role;
select pg_temp.connection_as('reconnect_required', null, now() - interval '5 minutes');
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
select is(
  (select (resolved_at is null) || '/' || (read_at is null)
    from pg_temp.notification('garmin_connection:c8000000-0000-4000-8000-0000000000a8:reconnect_required')),
  'true/true', 'a connection breaking again reopens its notification unread'
);

update public.notifications set read_at = now() where dedupe_key = pg_temp.watch_key('a');
reset role;
update public.provider_workouts set error_code = 'rate_limited'
  where external_key = 'd8000000-0000-4000-8000-000000000001:s-2';
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
select is(
  (select (payload ->> 'errorCode') || '/' || (resolved_at is null) || '/' || (read_at is not null)
    from pg_temp.notification(pg_temp.watch_key('a'))),
  'rate_limited/true/true', 'an open watch notification refreshes its payload and stays read'
);

reset role;
update public.provider_workouts set content_hash = repeat('c', 64)
  where external_key = 'd8000000-0000-4000-8000-000000000001:s-2';
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
select is(
  (select resolution || '/' || (read_at is not null) from pg_temp.notification(pg_temp.watch_key('a')))
    || ',' || (select coalesce(resolution, 'open') from pg_temp.notification(pg_temp.watch_key('c'))),
  'replaced/true,open', 'a changed workout that still fails replaces the earlier notification'
);

reset role;
update public.provider_workouts set status = 'sent', provider_workout_id = 7, sent_at = now(), error_code = null
  where external_key = 'd8000000-0000-4000-8000-000000000001:s-2';
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
select is(
  (select resolution || '/' || (read_at is not null) from pg_temp.notification(pg_temp.watch_key('c'))),
  'sent/true', 'a workout sent after a failure resolves as sent and read'
);

reset role;
update public.provider_workouts set status = 'needs_confirmation', provider_workout_id = null,
  sent_at = null, content_hash = repeat('b', 64)
  where external_key = 'd8000000-0000-4000-8000-000000000001:s-2';
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
select is(
  (select payload ->> 'status' from pg_temp.notification(pg_temp.watch_key('b'))),
  'needs_confirmation', 'a workout waiting for confirmation creates one notification per content'
);

reset role;
delete from public.provider_workouts
  where external_key = 'd8000000-0000-4000-8000-000000000001:s-2';
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
select is(
  (select resolution from pg_temp.notification(pg_temp.watch_key('b'))),
  'sent', 'a removed workout resolves its notification'
);

reset role;
insert into public.provider_workouts (
  connection_id, user_id, external_key, scheduled_on, status, content_hash, error_code
) values
  ('c8000000-0000-4000-8000-0000000000a8', 'a8000000-0000-4000-8000-0000000000a8',
   'd8000000-0000-4000-8000-000000000001:s-2', current_date + 2, 'failed', repeat('d', 64), 'sync_failed'),
  ('c8000000-0000-4000-8000-0000000000a8', 'a8000000-0000-4000-8000-0000000000a8',
   'd8000000-0000-4000-8000-000000000001:s-9', current_date - 3, 'failed', repeat('e', 64), 'sync_failed');
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
reset role;
update public.provider_workouts set scheduled_on = current_date - 3
  where external_key = 'd8000000-0000-4000-8000-000000000001:s-2';
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(null);
select is(
  (select resolution || '/' || (read_at is not null) from pg_temp.notification(pg_temp.watch_key('d')))
    || ',' || (select count(*)::int from public.notifications
      where dedupe_key like 'watch_workout:d8000000-0000-4000-8000-000000000001:s-9:%'),
  'replaced/true,0', 'past-dated watch failures are resolved as replaced and never created'
);

select public.reconcile_garmin_notifications(pg_temp.mismatch('e8000000-0000-4000-8000-000000000001'));
select is(
  (select payload ->> 'activityName' || '/' || (payload ->> 'garmin') || '/' || (payload ->> 'planned')
      || '/' || (resolved_at is null) || '/' || (read_at is null)
    from pg_temp.notification('gear_mismatch:e8000000-0000-4000-8000-000000000001')),
  'Footing · 50’/Zegama/Evo SL 3/true/true', 'a shoe mismatch creates an open question'
);
select public.reconcile_garmin_notifications(pg_temp.mismatch('e8000000-0000-4000-8000-0000000000b1'));
select is(
  (select count(*)::int from public.notifications where kind = 'gear_mismatch' and resolved_at is null),
  0, 'a mismatch for another athlete activity is ignored and the old question resolves'
);
select is(
  (select resolution || '/' || (read_at is not null)
    from pg_temp.notification('gear_mismatch:e8000000-0000-4000-8000-000000000001')),
  'answered/true', 'an answered shoe question resolves as answered and read'
);

select public.reconcile_garmin_notifications(pg_temp.mismatch('e8000000-0000-4000-8000-000000000001'));
select public.reconcile_garmin_notifications(null);
select is(
  (select resolved_at is null
    from pg_temp.notification('gear_mismatch:e8000000-0000-4000-8000-000000000001')),
  true, 'without pair checks the shoe questions are left untouched'
);

reset role;
update public.notifications set
  occurred_at = case
    when kind = 'garmin_connection' and resolved_at is null then occurred_at
    else now() - interval '5 days'
  end,
  read_at = case when read_at is not null then now() - interval '4 days' end,
  resolved_at = case when resolved_at is not null then now() - interval '4 days' end
where user_id = 'a8000000-0000-4000-8000-0000000000a8';
create temporary table before_snapshot as select pg_temp.snapshot() as rows;
grant select on before_snapshot to authenticated;
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications(pg_temp.mismatch('e8000000-0000-4000-8000-000000000001'));
select is(
  pg_temp.snapshot(), (select rows from before_snapshot),
  'a second reconcile with no new event changes no row, date or read state'
);

select throws_ok(
  $$select public.reconcile_garmin_notifications('{}')$$,
  '22023', null, 'mismatches must be an array'
);

select is(
  (select count(*)::int from public.notifications
    where user_id = 'b8000000-0000-4000-8000-0000000000b8'),
  0, 'the athlete cannot see another athlete notifications'
);

select pg_temp.act_as('b8000000-0000-4000-8000-0000000000b8');
select public.reconcile_garmin_notifications('[]');
select is(
  (select string_agg(kind, ',' order by kind) from public.notifications),
  'garmin_activity,garmin_connection', 'another athlete reconciles only their own data'
);
select is(
  (select count(*)::int from public.notifications
    where payload ->> 'activityId' like 'e8000000-0000-4000-8000-00000000000%'),
  0, 'another athlete never receives the first athlete activities'
);

reset role;
delete from public.provider_activities where id = 'e8000000-0000-4000-8000-000000000002';
select pg_temp.act_as('a8000000-0000-4000-8000-0000000000a8');
select public.reconcile_garmin_notifications('[]');
select is(
  (select count(*)::int from public.notifications
    where dedupe_key = 'garmin_activity:e8000000-0000-4000-8000-000000000002'),
  0, 'a deleted activity removes its notification'
);

select is(
  (select count(*)::int from public.notifications where kind = 'gear_mismatch' and resolved_at is null),
  0, 'an empty mismatch list resolves the open questions'
);

reset role;
select function_privs_are(
  'public', 'reconcile_garmin_notifications', array['jsonb'], 'anon', array[]::text[],
  'anonymous users have no reconcile privilege'
);

select * from finish();
rollback;
