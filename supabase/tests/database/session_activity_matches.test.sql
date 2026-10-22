begin;

create extension if not exists pgtap with schema extensions;

select plan(41);

grant usage on schema extensions to stride_coach_worker;

insert into auth.users (id, aud, role, email) values
  ('a2000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'match-a@example.com'),
  ('b2000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'match-b@example.com');

insert into public.training_plans (id, user_id, title, starts_on, ends_on, active_version, time_zone)
values ('d2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-0000000000a2',
  'Plan A', current_date - 7, current_date + 60, 1, 'Europe/Paris');

insert into public.plan_versions (plan_id, version, user_id, created_by, effective_from, confidence, content_hash)
values ('d2000000-0000-4000-8000-000000000001', 1, 'a2000000-0000-4000-8000-0000000000a2',
  'coach', current_date, '{"level": "normal", "reasons": []}', 'hash');

insert into public.plan_sessions (
  plan_id, user_id, session_key, valid_from_version, scheduled_on, sport, kind, title, purpose,
  is_key, priority, targets, structure, origin
)
select 'd2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-0000000000a2', key,
  1, current_date + offset_days, sport, kind, 'Séance', 'Objectif', false, 'normal',
  '{"durationSeconds": 2400, "distanceMeters": 8000, "elevationGainMeters": null}', '[]', 'template'
from (values ('s-1', 1, 'run', 'easy'), ('s-2', 2, 'run', 'easy'), ('s-3', 3, 'run', 'easy'),
  ('s-4', 4, 'run', 'easy'), ('s-5', 5, 'rest', 'rest'), ('m-1', 0, 'strength', 'mobility'),
  ('m-2', -1, 'strength', 'mobility'), ('m-3', 2, 'strength', 'mobility'),
  ('k-1', 0, 'strength', 'strength'))
  as v (key, offset_days, sport, kind);

create function pg_temp.act_as(p_user uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.auto(p_key text, p_activity text)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'sessionKey', p_key, 'activityId', p_activity, 'status', 'completed', 'confidence', 0.9,
    'compliance', jsonb_build_object('duration', 1, 'distance', 1, 'intensity', null)
  );
$$;

create function pg_temp.matches()
returns text
language sql
as $$
  select string_agg(
    session_key || ':' || coalesce(right(activity_id::text, 2), '-') || ':' || method || ':' || status,
    ',' order by session_key, activity_id
  )
  from public.session_activity_matches;
$$;

select ok(
  has_function_privilege('stride_coach_worker', 'private.record_session_matches(uuid, jsonb, text)', 'execute')
    and not has_function_privilege('authenticated', 'private.record_session_matches(uuid, jsonb, text)', 'execute')
    and not has_function_privilege('service_role', 'private.record_session_matches(uuid, jsonb, text)', 'execute')
    and not has_function_privilege('anon', 'private.record_session_matches(uuid, jsonb, text)', 'execute'),
  'only the coach worker may record matches'
);
select ok(
  has_function_privilege('authenticated', 'public.set_session_match(uuid, text, uuid[], text)', 'execute')
    and has_function_privilege('authenticated', 'public.clear_session_match(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.set_session_match(uuid, text, uuid[], text)', 'execute')
    and not has_function_privilege('anon', 'public.clear_session_match(uuid, text)', 'execute')
    and not has_function_privilege('authenticated', 'private.owned_current_session(uuid, text)', 'execute'),
  'only athletes may call the override RPCs'
);
select ok(
  not has_table_privilege('authenticated', 'public.session_activity_matches', 'insert')
    and not has_table_privilege('authenticated', 'public.session_activity_matches', 'update')
    and not has_table_privilege('authenticated', 'public.session_activity_matches', 'delete')
    and not has_table_privilege('service_role', 'public.session_activity_matches', 'insert')
    and not has_table_privilege('anon', 'public.session_activity_matches', 'select'),
  'no API role may write the matches table'
);

set local role stride_coach_worker;
select is(
  private.record_session_matches('d2000000-0000-4000-8000-000000000001', jsonb_build_array(
    pg_temp.auto('s-1', 'ac000000-0000-4000-8000-000000000001'),
    pg_temp.auto('s-2', 'ac000000-0000-4000-8000-000000000002')
  ), 'match-v1'),
  2, 'the worker records an auto set'
);
select throws_ok(
  $$select private.record_session_matches('d2000000-0000-4000-8000-000000000001',
    jsonb_build_array(pg_temp.auto('s-9', 'ac000000-0000-4000-8000-000000000001')), 'match-v1')$$,
  'PT422', 'unknown_key', 'an unknown session key is rejected'
);
select throws_ok(
  $$select private.record_session_matches('d2000000-0000-4000-8000-000000000001',
    jsonb_build_array(pg_temp.auto('s-5', 'ac000000-0000-4000-8000-000000000001')), 'match-v1')$$,
  'PT422', 'unknown_key', 'a rest session is never matched'
);
select throws_ok(
  $$select private.record_session_matches('d2000000-0000-4000-8000-000000000001',
    jsonb_build_array(pg_temp.auto('s-1', 'ac000000-0000-4000-8000-000000000001'),
      pg_temp.auto('s-2', 'ac000000-0000-4000-8000-000000000001')), 'match-v1')$$,
  'PT400', 'invalid_matches', 'an activity cannot match two sessions'
);
select throws_ok(
  $$select private.record_session_matches('d2000000-0000-4000-8000-0000000000ff', '[]', 'match-v1')$$,
  'PT404', 'not_found', 'an unknown plan is not found'
);
reset role;

select is(
  (select array_agg(distinct user_id::text || ':' || algorithm_version) from public.session_activity_matches),
  array['a2000000-0000-4000-8000-0000000000a2:match-v1'],
  'auto rows derive the athlete from the plan and carry the algorithm version'
);

select pg_temp.act_as('a2000000-0000-4000-8000-0000000000a2');
select throws_ok(
  $$select private.record_session_matches('d2000000-0000-4000-8000-000000000001', '[]', 'match-v1')$$,
  '42501', null, 'athlete cannot call the worker function'
);
select throws_ok(
  $$insert into public.session_activity_matches (user_id, plan_id, session_key, session_revision_id, activity_id, method, confidence, status)
    select user_id, plan_id, session_key, id, null, 'athlete', 1, 'dismissed' from public.plan_sessions limit 1$$,
  '42501', null, 'athlete cannot insert matches directly'
);
select throws_ok(
  $$update public.session_activity_matches set status = 'partial'$$,
  '42501', null, 'athlete cannot update matches directly'
);
select throws_ok(
  $$delete from public.session_activity_matches$$,
  '42501', null, 'athlete cannot delete matches directly'
);
select is(
  (select count(*)::int from public.set_session_match('d2000000-0000-4000-8000-000000000001', 's-3',
    array['ac000000-0000-4000-8000-000000000002']::uuid[], 'partial')),
  1, 'athlete links their activity to a session'
);
select is(
  pg_temp.matches(), 's-1:01:auto:completed,s-3:02:athlete:partial',
  'the override steals the activity from its auto row'
);
select throws_ok(
  $$select public.set_session_match('d2000000-0000-4000-8000-000000000001', 's-9',
    array['ac000000-0000-4000-8000-000000000001']::uuid[])$$,
  'PT404', 'not_found', 'athlete cannot link an unknown session'
);
select throws_ok(
  $$select public.set_session_match('d2000000-0000-4000-8000-000000000001', 's-1',
    array['ac000000-0000-4000-8000-000000000001']::uuid[], 'dismissed')$$,
  'PT400', 'invalid_status', 'a linked activity needs a match status'
);
reset role;

create temp table override_snapshot as
  select string_agg(r::text, ',' order by r.id) as digest
  from public.session_activity_matches r where method = 'athlete';

set local role stride_coach_worker;
select is(
  private.record_session_matches('d2000000-0000-4000-8000-000000000001', jsonb_build_array(
    pg_temp.auto('s-1', 'ac000000-0000-4000-8000-000000000001'),
    pg_temp.auto('s-2', 'ac000000-0000-4000-8000-000000000002'),
    pg_temp.auto('s-3', 'ac000000-0000-4000-8000-000000000003')
  ), 'match-v1'),
  1, 'recomputation skips sessions and activities covered by an override'
);
reset role;

select ok(
  (select digest = (select string_agg(r::text, ',' order by r.id)
    from public.session_activity_matches r where method = 'athlete') from override_snapshot),
  'recomputation leaves athlete rows unchanged'
);

select pg_temp.act_as('a2000000-0000-4000-8000-0000000000a2');
select is(
  (select status || ':' || coalesce(activity_id::text, '-') from public.set_session_match(
    'd2000000-0000-4000-8000-000000000001', 's-1', '{}')),
  'dismissed:-', 'athlete marks a session as not done'
);
select is(
  pg_temp.matches(), 's-1:-:athlete:dismissed,s-3:02:athlete:partial',
  'dismissal replaces the session rows'
);
reset role;

set local role stride_coach_worker;
select is(
  private.record_session_matches('d2000000-0000-4000-8000-000000000001', jsonb_build_array(
    pg_temp.auto('s-1', 'ac000000-0000-4000-8000-000000000001')
  ), 'match-v1'),
  0, 'auto matching skips a dismissed session'
);
reset role;

select pg_temp.act_as('a2000000-0000-4000-8000-0000000000a2');
select is(
  public.clear_session_match('d2000000-0000-4000-8000-000000000001', 's-1'),
  1, 'clearing removes the athlete rows of the session'
);
select is(pg_temp.matches(), 's-3:02:athlete:partial', 'the session returns to auto matching');
reset role;

select pg_temp.act_as('b2000000-0000-4000-8000-0000000000b2');
select is(
  (select count(*)::int from public.session_activity_matches),
  0, 'another athlete reads none of the matches'
);
select throws_ok(
  $$select public.set_session_match('d2000000-0000-4000-8000-000000000001', 's-1',
    array['ac000000-0000-4000-8000-0000000000b1']::uuid[])$$,
  'PT404', 'not_found', 'another athlete cannot override a foreign plan'
);
select throws_ok(
  $$select public.clear_session_match('d2000000-0000-4000-8000-000000000001', 's-3')$$,
  'PT404', 'not_found', 'another athlete cannot clear a foreign override'
);
reset role;

set local role anon;
select throws_ok(
  $$select count(*) from public.session_activity_matches$$,
  '42501', null, 'anonymous visitors have no access'
);
reset role;

insert into public.plan_proposals (id, user_id, plan_id, base_version, scope, origin, requested_by, status, title, operations, target_keys)
values
  ('e2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-0000000000a2',
    'd2000000-0000-4000-8000-000000000001', 1, 'session', 'schedule', 'system', 'accepted', 'Déplacer', '[]', '{s-3}'),
  ('e2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-0000000000a2',
    'd2000000-0000-4000-8000-000000000001', 1, 'session', 'schedule', 'system', 'accepted', 'Retirer', '[]', '{s-4}');

create function pg_temp.closing(p_key text)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'plan', null,
    'blocks', jsonb_build_object('closed', '[]'::jsonb, 'added', '[]'::jsonb),
    'weeks', jsonb_build_object('closed', '[]'::jsonb, 'added', '[]'::jsonb),
    'sessions', jsonb_build_object('closed', jsonb_build_array(p_key), 'added', '[]'::jsonb)
  );
$$;

set local role stride_coach_worker;
select throws_ok(
  $$select private.apply_plan_proposal('e2000000-0000-4000-8000-000000000001', pg_temp.closing('s-3'))$$,
  'PT422', 'frozen_session', 'a matched session cannot be changed'
);
reset role;

select is(
  (select array[
    (select active_version from public.training_plans where id = 'd2000000-0000-4000-8000-000000000001'),
    (select count(*)::int from public.plan_sessions where valid_to_version is not null)
  ]),
  array[1, 0], 'a rejected apply on a matched session writes nothing'
);

set local role stride_coach_worker;
select is(
  (private.apply_plan_proposal('e2000000-0000-4000-8000-000000000002', pg_temp.closing('s-4'))).version,
  2, 'an unmatched future session can still be changed'
);
reset role;

select ok(
  has_function_privilege('authenticated', 'public.check_in_session(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.check_in_session(uuid, text)', 'execute')
    and not has_function_privilege('service_role', 'public.check_in_session(uuid, text)', 'execute'),
  'only athletes may check in a session'
);

select pg_temp.act_as('a2000000-0000-4000-8000-0000000000a2');
select is(
  (select status || ':' || coalesce(activity_id::text, '-') || ':' || method
    from public.check_in_session('d2000000-0000-4000-8000-000000000001', 'm-1')),
  'checked_in:-:athlete', 'athlete checks in a mobility session of today'
);
select is(
  (select count(*)::int from public.check_in_session('d2000000-0000-4000-8000-000000000001', 'm-2')),
  1, 'athlete checks in a past mobility session'
);
select throws_ok(
  $$select public.check_in_session('d2000000-0000-4000-8000-000000000001', 'm-3')$$,
  'PT400', 'not_due', 'a future mobility session cannot be checked in'
);
select throws_ok(
  $$select public.check_in_session('d2000000-0000-4000-8000-000000000001', 'k-1')$$,
  'PT400', 'not_checkable', 'a strength session cannot be checked in'
);
select throws_ok(
  $$select public.check_in_session('d2000000-0000-4000-8000-000000000001', 's-2')$$,
  'PT400', 'not_checkable', 'a run session cannot be checked in'
);
reset role;

set local role stride_coach_worker;
select is(
  private.record_session_matches('d2000000-0000-4000-8000-000000000001', jsonb_build_array(
    pg_temp.auto('m-1', 'ac000000-0000-4000-8000-000000000009')
  ), 'match-v1'),
  0, 'auto matching skips a checked-in session'
);
reset role;

select pg_temp.act_as('b2000000-0000-4000-8000-0000000000b2');
select throws_ok(
  $$select public.check_in_session('d2000000-0000-4000-8000-000000000001', 'm-1')$$,
  'PT404', 'not_found', 'another athlete cannot check in a foreign session'
);
reset role;

select pg_temp.act_as('a2000000-0000-4000-8000-0000000000a2');
select is(
  public.clear_session_match('d2000000-0000-4000-8000-000000000001', 'm-1'),
  1, 'athlete undoes a check-in'
);
select is(
  (select count(*)::int from public.session_activity_matches where session_key = 'm-1'),
  0, 'an undone check-in leaves the session neutral'
);
reset role;

select * from finish();

rollback;
