begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, aud, role, email) values
  ('a3000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'refresh-a@example.com'),
  ('b3000000-0000-4000-8000-0000000000b3', 'authenticated', 'authenticated', 'refresh-b@example.com');

insert into public.training_plans (id, user_id, title, starts_on, ends_on, active_version, time_zone)
values ('d3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-0000000000a3',
  'Plan A', current_date - 7, current_date + 60, 1, 'Europe/Paris');

insert into public.plan_versions (plan_id, version, user_id, created_by, effective_from, confidence, content_hash)
values ('d3000000-0000-4000-8000-000000000001', 1, 'a3000000-0000-4000-8000-0000000000a3',
  'coach', current_date, '{"level": "normal", "reasons": []}', 'hash');

insert into public.plan_sessions (
  plan_id, user_id, session_key, valid_from_version, scheduled_on, sport, kind, title, purpose,
  is_key, priority, targets, structure, origin
)
select 'd3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-0000000000a3', key,
  1, current_date - offset_days, 'run', 'easy', 'Séance', 'Objectif', false, 'normal',
  '{"durationSeconds": 2400, "distanceMeters": 8000, "elevationGainMeters": null}', '[]', 'template'
from (values ('s-1', 3), ('s-2', 2), ('s-3', 1)) as v (key, offset_days);

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
    session_key || ':' || coalesce(right(activity_id::text, 2), '-') || ':' || method,
    ',' order by session_key, activity_id
  )
  from public.session_activity_matches;
$$;

select ok(
  has_function_privilege('authenticated', 'public.refresh_session_matches(uuid, integer, jsonb, text, timestamptz)', 'execute')
    and not has_function_privilege('anon', 'public.refresh_session_matches(uuid, integer, jsonb, text, timestamptz)', 'execute')
    and not has_function_privilege('service_role', 'public.refresh_session_matches(uuid, integer, jsonb, text, timestamptz)', 'execute'),
  'only athletes may refresh their matches'
);

select pg_temp.act_as('a3000000-0000-4000-8000-0000000000a3');
select is(
  (select array[matches_computed_at::text, matches_version::text] from public.training_plans),
  array[null, null]::text[], 'a new plan has no computed matches'
);
select is(
  public.refresh_session_matches('d3000000-0000-4000-8000-000000000001', 1, jsonb_build_array(
    pg_temp.auto('s-1', 'ac000000-0000-4000-8000-000000000001'),
    pg_temp.auto('s-2', 'ac000000-0000-4000-8000-000000000002')
  ), 'match-v1', '2026-10-16T08:00:00Z'),
  2, 'the athlete records the matcher output for their plan'
);
select is(
  (select matches_version from public.training_plans), 1,
  'the refresh marks the matched version'
);
select is(
  (select matches_activities_through from public.training_plans), '2026-10-16T08:00:00Z'::timestamptz,
  'the refresh marks the latest activity change it matched'
);
select ok(
  (select matches_computed_at is not null from public.training_plans),
  'the refresh marks when matches were computed'
);
select is(
  public.refresh_session_matches('d3000000-0000-4000-8000-000000000001', 1, jsonb_build_array(
    pg_temp.auto('s-1', 'ac000000-0000-4000-8000-000000000001'),
    pg_temp.auto('s-2', 'ac000000-0000-4000-8000-000000000002')
  ), 'match-v1', null),
  2, 'refreshing again is idempotent'
);
select is(pg_temp.matches(), 's-1:01:auto,s-2:02:auto', 'the auto rows are replaced, not duplicated');
select is(
  (select count(*)::int from public.set_session_match('d3000000-0000-4000-8000-000000000001', 's-3',
    array['ac000000-0000-4000-8000-000000000003']::uuid[])),
  1, 'the athlete links an activity by hand'
);
select is(
  public.refresh_session_matches('d3000000-0000-4000-8000-000000000001', 1, jsonb_build_array(
    pg_temp.auto('s-1', 'ac000000-0000-4000-8000-000000000001'),
    pg_temp.auto('s-3', 'ac000000-0000-4000-8000-000000000004')
  ), 'match-v1', null),
  1, 'a refresh skips sessions the athlete matched'
);
select is(pg_temp.matches(), 's-1:01:auto,s-3:03:athlete', 'athlete rows survive a refresh');
select throws_ok(
  $$select public.refresh_session_matches('d3000000-0000-4000-8000-000000000001', 2, '[]', 'match-v1', null)$$,
  'PT409', 'stale_version', 'a refresh computed on another version is rejected'
);
reset role;

select pg_temp.act_as('b3000000-0000-4000-8000-0000000000b3');
select throws_ok(
  $$select public.refresh_session_matches('d3000000-0000-4000-8000-000000000001', 1, '[]', 'match-v1', null)$$,
  'PT404', 'not_found', 'another athlete cannot refresh a foreign plan'
);
reset role;

select * from finish();
rollback;
