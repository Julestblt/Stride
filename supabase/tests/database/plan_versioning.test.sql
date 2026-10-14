begin;

create extension if not exists pgtap with schema extensions;

select plan(77);

grant usage on schema extensions to stride_coach_worker;

insert into auth.users (id, aud, role, email) values
  ('a1000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'plan-a@example.com'),
  ('b1000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'plan-b@example.com');

create function pg_temp.act_as(p_user uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.session(p_key text, p_offset integer)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'sessionKey', p_key,
    'scheduledOn', (current_date + p_offset)::text,
    'sport', 'run',
    'kind', 'easy',
    'title', 'Footing',
    'purpose', 'Endurance fondamentale',
    'isKey', false,
    'priority', 'normal',
    'targets', jsonb_build_object('durationSeconds', 2400, 'distanceMeters', null, 'elevationGainMeters', null),
    'structure', jsonb_build_array(jsonb_build_object(
      'type', 'work',
      'end', jsonb_build_object('kind', 'time', 'seconds', 2400),
      'target', jsonb_build_object('kind', 'rpe', 'min', 3, 'max', 4),
      'intensity', 'easy'
    )),
    'terrain', 'road',
    'origin', 'template',
    'contingencies', '[]'::jsonb
  );
$$;

create function pg_temp.changeset(
  p_plan jsonb,
  p_closed text[],
  p_added jsonb,
  p_blocks jsonb default '[]',
  p_weeks jsonb default '[]',
  p_closed_weeks text[] default '{}'
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'plan', p_plan,
    'blocks', jsonb_build_object('closed', '[]'::jsonb, 'added', p_blocks),
    'weeks', jsonb_build_object('closed', to_jsonb(p_closed_weeks), 'added', p_weeks),
    'sessions', jsonb_build_object('closed', to_jsonb(p_closed), 'added', p_added)
  );
$$;

create function pg_temp.header(p_title text)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'id', 'draft',
    'title', p_title,
    'startsOn', date_trunc('week', current_date)::date::text,
    'endsOn', (date_trunc('week', current_date)::date + 60)::text,
    'timeZone', 'Europe/Paris',
    'primaryRaceId', null,
    'raceRoles', '[]'::jsonb,
    'confidence', jsonb_build_object('level', 'normal', 'reasons', '[]'::jsonb)
  );
$$;

create function pg_temp.week(p_duration integer)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'weekKey', 'w-1', 'weekStart', date_trunc('week', current_date)::date::text,
    'blockKey', 'b-1', 'weekType', 'build',
    'targets', jsonb_build_object(
      'durationSeconds', p_duration, 'distanceMeters', null, 'elevationGainMeters', null,
      'qualitySessions', 0, 'longRunSeconds', null,
      'intensitySplit', jsonb_build_object('easyPct', 100, 'moderatePct', 0, 'hardPct', 0)
    ),
    'notes', null
  );
$$;

create function pg_temp.creation(p_title text)
returns jsonb
language sql
as $$
  select pg_temp.changeset(
    pg_temp.header(p_title),
    '{}',
    jsonb_build_array(pg_temp.session('s-1', 2), pg_temp.session('s-2', 3), pg_temp.session('s-3', 4)),
    jsonb_build_array(jsonb_build_object(
      'blockKey', 'b-1', 'kind', 'base', 'name', 'Foncier',
      'startsOn', date_trunc('week', current_date)::date::text,
      'endsOn', (date_trunc('week', current_date)::date + 60)::text,
      'objective', 'Construire la base', 'raceId', null
    )),
    jsonb_build_array(pg_temp.week(7200))
  );
$$;

create function pg_temp.structure_at(p_version integer)
returns text
language sql
as $$
  select concat_ws('|',
    (select string_agg(block_key, ',' order by block_key) from public.plan_blocks
      where plan_id = v.plan_id and valid_from_version <= v.version
        and v.version < coalesce(valid_to_version, 2147483647)),
    (select string_agg(week_key || '@' || target_duration_s, ',' order by week_key) from public.plan_weeks
      where plan_id = v.plan_id and valid_from_version <= v.version
        and v.version < coalesce(valid_to_version, 2147483647)),
    v.race_roles::text,
    v.confidence ->> 'level'
  )
  from public.plan_versions v
  where v.version = p_version
    and v.plan_id = (select id from public.training_plans where title = 'Plan A');
$$;

create function pg_temp.sessions_at(p_version integer)
returns text
language sql
as $$
  select string_agg(session_key || '@' || (scheduled_on - current_date), ',' order by session_key)
  from public.plan_sessions
  where user_id = 'a1000000-0000-4000-8000-0000000000a1'
    and valid_from_version <= p_version
    and p_version < coalesce(valid_to_version, 2147483647)
    and plan_id = (select id from public.training_plans where title = 'Plan A')
    and exists (
      select 1 from public.plan_versions
      where plan_id = plan_sessions.plan_id and version = p_version
    );
$$;

insert into public.plan_proposals (id, user_id, scope, origin, requested_by, status, title, operations)
values
  ('10000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-0000000000a1',
    'new_plan', 'training', 'athlete', 'ready', 'Nouveau plan', '[]');

select pg_temp.act_as('a1000000-0000-4000-8000-0000000000a1');
select is(
  (public.accept_plan_proposal('10000000-0000-4000-8000-000000000001', '  Allons-y  ')).status,
  'accepted', 'athlete accepts their ready proposal'
);
select is(
  (select note from public.plan_decisions where proposal_id = '10000000-0000-4000-8000-000000000001'),
  'Allons-y', 'acceptance records a trimmed note'
);
select throws_ok(
  $$select private.apply_plan_proposal('10000000-0000-4000-8000-000000000001', '{}')$$,
  '42501', null, 'athlete cannot call the apply function'
);
reset role;

set local role service_role;
select throws_ok(
  $$select private.apply_plan_proposal('10000000-0000-4000-8000-000000000001', '{}')$$,
  '42501', null, 'service role cannot call the apply function'
);
reset role;

select ok(
  has_function_privilege('stride_coach_worker', 'private.apply_plan_proposal(uuid, jsonb)', 'execute'),
  'coach worker may execute the apply function'
);
select ok(
  not has_function_privilege('authenticated', 'private.apply_plan_proposal(uuid, jsonb)', 'execute')
    and not has_function_privilege('service_role', 'private.apply_plan_proposal(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'private.apply_plan_proposal(uuid, jsonb)', 'execute'),
  'no API role may execute the apply function'
);
select ok(
  not has_function_privilege('anon', 'public.accept_plan_proposal(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.reject_plan_proposal(uuid, text)', 'execute')
    and has_function_privilege('authenticated', 'public.accept_plan_proposal(uuid, text)', 'execute')
    and has_function_privilege('authenticated', 'public.reject_plan_proposal(uuid, text)', 'execute'),
  'only athletes may call the decision RPCs'
);

set local role stride_coach_worker;
select is(
  (private.apply_plan_proposal('10000000-0000-4000-8000-000000000001', pg_temp.creation('Plan A'))).version,
  1, 'applying a new plan creates version 1'
);
select throws_ok(
  $$select private.apply_plan_proposal('10000000-0000-4000-8000-000000000001', pg_temp.creation('Plan A'))$$,
  'PT409', 'invalid_state', 'an applied proposal cannot be applied again'
);
reset role;

select is(
  (select array[status, active_version::text] from public.training_plans where title = 'Plan A'),
  array['active', '1'], 'the plan is active at version 1'
);
select is(
  (select array[status, applied_version::text] from public.plan_proposals
    where id = '10000000-0000-4000-8000-000000000001'),
  array['applied', '1'], 'the proposal is marked applied'
);
select ok(
  (select plan_id = (select id from public.training_plans where title = 'Plan A')
    from public.plan_proposals where id = '10000000-0000-4000-8000-000000000001'),
  'the applied new-plan proposal links to the created plan'
);
select is(
  (select array_agg(decision || ':' || actor || ':' || coalesce(resulting_version::text, '-') order by created_at, decision)
    from public.plan_decisions where proposal_id = '10000000-0000-4000-8000-000000000001'),
  array['accepted:athlete:-', 'applied:system:1'], 'acceptance and application are audited'
);
select is(
  (select array[count(*) filter (where valid_from_version = 1), count(*)]::int[]
    from public.plan_sessions where user_id = 'a1000000-0000-4000-8000-0000000000a1'),
  array[3, 3], 'every created session is valid from version 1'
);
select is(
  (select array[
    (select count(*) from public.plan_blocks where valid_from_version = 1),
    (select count(*) from public.plan_weeks where valid_from_version = 1),
    (select count(*) from public.plan_versions where version = 1)
  ]::int[]),
  array[1, 1, 1], 'blocks, weeks and the version row are created'
);

insert into public.plan_proposals (id, user_id, plan_id, base_version, scope, origin, requested_by, status, title, operations, target_keys)
select '10000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-0000000000a1', id, 1,
  'session', 'schedule', 'athlete', 'ready', 'Déplacer la sortie', '[]', '{s-1}'
from public.training_plans where title = 'Plan A';

select pg_temp.act_as('a1000000-0000-4000-8000-0000000000a1');
select is(
  (public.accept_plan_proposal('10000000-0000-4000-8000-000000000002')).status,
  'accepted', 'athlete accepts a session change'
);
reset role;

set local role stride_coach_worker;
select is(
  (private.apply_plan_proposal(
    '10000000-0000-4000-8000-000000000002',
    pg_temp.changeset(null, '{s-1}', jsonb_build_array(pg_temp.session('s-1', 5)))
  )).version,
  2, 'a one-session change creates version 2'
);
reset role;

select is(
  (select array[
    (select count(*) from public.plan_sessions where valid_to_version = 2),
    (select count(*) from public.plan_sessions where valid_from_version = 2),
    (select count(*) from public.plan_sessions)
  ]::int[]),
  array[1, 1, 4], 'a one-session change touches exactly two session rows'
);
select is(
  (select race_roles || jsonb_build_array(confidence) from public.plan_versions where version = 2),
  '[{"level": "normal", "reasons": []}]'::jsonb, 'race roles and confidence carry over when the header is unchanged'
);

insert into public.plan_proposals (id, user_id, plan_id, base_version, scope, origin, requested_by, status, title, operations, target_keys)
select '10000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-0000000000a1', id, 2,
  'session', 'recovery', 'system', 'accepted', 'Retirer la sortie', '[]', '{s-3}'
from public.training_plans where title = 'Plan A';

set local role stride_coach_worker;
select is(
  (private.apply_plan_proposal(
    '10000000-0000-4000-8000-000000000003',
    pg_temp.changeset(
      pg_temp.header('Plan A')
        || jsonb_build_object(
          'raceRoles', jsonb_build_array(jsonb_build_object('raceId', 'c2000000-0000-4000-8000-0000000000c2', 'role', 'secondary')),
          'confidence', jsonb_build_object('level', 'low', 'reasons', jsonb_build_array('Peu de données'))
        ),
      '{s-3}', '[]', '[]', jsonb_build_array(pg_temp.week(9000)), '{w-1}'
    )
  )).version,
  3, 'removing a session creates version 3'
);
reset role;

select is(pg_temp.sessions_at(1), 's-1@2,s-2@3,s-3@4', 'version 1 reads its own sessions');
select is(pg_temp.sessions_at(2), 's-1@5,s-2@3,s-3@4', 'version 2 reads the moved session');
select is(pg_temp.sessions_at(3), 's-1@5,s-2@3', 'version 3 reads without the removed session');
select is(pg_temp.sessions_at(4), null, 'an unknown version has no rows');
select is(pg_temp.structure_at(1), 'b-1|w-1@7200|[]|normal', 'version 1 reads its blocks, weeks and header');
select is(pg_temp.structure_at(2), 'b-1|w-1@7200|[]|normal', 'version 2 shares blocks, weeks and header');
select is(
  pg_temp.structure_at(3),
  'b-1|w-1@9000|[{"role": "secondary", "raceId": "c2000000-0000-4000-8000-0000000000c2"}]|low',
  'version 3 reads its changed week, race roles and confidence'
);
select is(pg_temp.structure_at(4), null, 'an unknown version has no version row');
select is(
  (select created_by from public.plan_versions where version = 3),
  'coach', 'system-requested versions are created by the coach'
);

insert into public.plan_proposals (id, user_id, plan_id, base_version, scope, origin, requested_by, status, title, operations, target_keys)
select v.id, 'a1000000-0000-4000-8000-0000000000a1', p.id, v.base, 'session', 'training', 'system',
  v.status, 'Changement', '[]', v.targets
from public.training_plans p
cross join (values
  ('10000000-0000-4000-8000-000000000004'::uuid, 2, 'accepted', '{s-2}'::text[]),
  ('10000000-0000-4000-8000-000000000005'::uuid, 3, 'accepted', '{s-2}'::text[]),
  ('10000000-0000-4000-8000-000000000006'::uuid, 3, 'accepted', '{s-9}'::text[]),
  ('10000000-0000-4000-8000-000000000007'::uuid, 3, 'ready', '{s-1}'::text[]),
  ('10000000-0000-4000-8000-000000000008'::uuid, 3, 'rejected', '{s-1}'::text[])
) as v (id, base, status, targets)
where p.title = 'Plan A';

update public.plan_sessions set scheduled_on = current_date - 3
  where session_key = 's-2' and valid_to_version is null;

set local role stride_coach_worker;
select throws_ok(
  $$select private.apply_plan_proposal('10000000-0000-4000-8000-000000000004',
    pg_temp.changeset(null, '{s-1}', jsonb_build_array(pg_temp.session('s-1', 6))))$$,
  'PT409', 'stale_version', 'a stale base version is rejected'
);
select throws_ok(
  $$select private.apply_plan_proposal('10000000-0000-4000-8000-000000000005',
    pg_temp.changeset(null, '{s-2}', jsonb_build_array(pg_temp.session('s-2', 6))))$$,
  'PT422', 'frozen_session', 'a past session cannot be closed'
);
select throws_ok(
  $$select private.apply_plan_proposal('10000000-0000-4000-8000-000000000006',
    pg_temp.changeset(null, '{}', jsonb_build_array(pg_temp.session('s-9', -2))))$$,
  'PT422', 'frozen_session', 'a session cannot be added before local today'
);
select throws_ok(
  $$select private.apply_plan_proposal('10000000-0000-4000-8000-000000000006',
    pg_temp.changeset(null, '{s-404}', '[]'))$$,
  'PT422', 'unknown_key', 'closing an unknown key is rejected'
);
select throws_ok(
  $$select private.apply_plan_proposal('10000000-0000-4000-8000-000000000006', '{"plan": null}')$$,
  'PT400', 'invalid_changeset', 'a malformed changeset is rejected'
);
select throws_ok(
  $$select private.apply_plan_proposal('10000000-0000-4000-8000-000000000006',
    pg_temp.changeset(null, '{}', '[]') - 'plan')$$,
  'PT400', 'invalid_changeset', 'a changeset without a plan key is rejected'
);
select throws_ok(
  $$select private.apply_plan_proposal('10000000-0000-4000-8000-000000000007',
    pg_temp.changeset(null, '{s-1}', '[]'))$$,
  'PT409', 'invalid_state', 'a ready proposal cannot be applied'
);
select throws_ok(
  $$select private.apply_plan_proposal('10000000-0000-4000-8000-000000000008',
    pg_temp.changeset(null, '{s-1}', '[]'))$$,
  'PT409', 'invalid_state', 'a rejected proposal cannot be applied'
);
reset role;

select is(
  (select array[
    (select active_version from public.training_plans where title = 'Plan A'),
    (select count(*)::int from public.plan_sessions),
    (select count(*)::int from public.plan_versions)
  ]),
  array[3, 4, 3], 'rejected applies write nothing'
);

update public.plan_proposals set expires_at = now() - interval '1 minute'
  where id = '10000000-0000-4000-8000-000000000008';
insert into public.plan_proposals (id, user_id, plan_id, base_version, scope, origin, requested_by, status, title, operations, target_keys, expires_at)
select '10000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-0000000000a1', id, 3,
  'session', 'training', 'system', 'ready', 'Expirée', '[]', '{s-2}', now() - interval '1 minute'
from public.training_plans where title = 'Plan A';

select throws_ok(
  $$insert into public.plan_proposals (user_id, plan_id, base_version, scope, origin, requested_by, status, title, operations, target_keys)
    select 'a1000000-0000-4000-8000-0000000000a1', id, 3, 'session', 'training', 'system', 'ready', 'Doublon', '[]', '{s-1}'
    from public.training_plans where title = 'Plan A'$$,
  '23505', null, 'only one ready proposal exists per plan target'
);

select pg_temp.act_as('a1000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$select public.accept_plan_proposal('10000000-0000-4000-8000-000000000009')$$,
  'PT409', 'invalid_state', 'an expired proposal cannot be accepted'
);
select throws_ok(
  $$select public.reject_plan_proposal('10000000-0000-4000-8000-000000000008')$$,
  'PT409', 'invalid_state', 'a rejected proposal cannot be rejected again'
);
select throws_ok(
  $$select public.accept_plan_proposal('10000000-0000-4000-8000-000000000001')$$,
  'PT409', 'invalid_state', 'an applied proposal cannot be accepted'
);
select throws_ok(
  $$select public.reject_plan_proposal('10000000-0000-4000-8000-000000000007', repeat('x', 501))$$,
  'PT400', 'invalid_note', 'a note longer than 500 characters is rejected'
);
select throws_ok(
  $$select public.accept_plan_proposal('10000000-0000-4000-8000-0000000000ff')$$,
  'PT404', 'not_found', 'a missing proposal is not found'
);
select is(
  (public.reject_plan_proposal('10000000-0000-4000-8000-000000000007', 'Pas cette semaine')).status,
  'rejected', 'athlete rejects their ready proposal'
);
select is(
  (select decision || ':' || actor || ':' || note from public.plan_decisions
    where proposal_id = '10000000-0000-4000-8000-000000000007'),
  'rejected:athlete:Pas cette semaine', 'rejection records the decision and note'
);
select throws_ok(
  $$insert into public.plan_sessions (plan_id, user_id, session_key, valid_from_version, scheduled_on, sport, kind, title, purpose, is_key, priority, targets, structure, origin)
    select id, user_id, 's-8', 4, current_date + 8, 'run', 'easy', 'Footing', 'Endurance', false, 'normal', '{}', '[]', 'athlete'
    from public.training_plans$$,
  '42501', null, 'athlete cannot insert plan sessions'
);
select throws_ok(
  $$update public.training_plans set title = 'Mon plan'$$,
  '42501', null, 'athlete cannot update plans'
);
select throws_ok(
  $$update public.plan_proposals set status = 'accepted'$$,
  '42501', null, 'athlete cannot update proposals'
);
select throws_ok(
  $$insert into public.plan_decisions (user_id, proposal_id, decision, actor)
    values ('a1000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000007', 'accepted', 'athlete')$$,
  '42501', null, 'athlete cannot insert decisions'
);
select throws_ok(
  $$delete from public.plan_versions$$,
  '42501', null, 'athlete cannot delete versions'
);
select throws_ok(format('insert into public.%I default values', t), '42501', null, 'athlete cannot insert into ' || t)
from unnest(array['training_plans', 'plan_versions', 'plan_blocks', 'plan_weeks', 'plan_sessions', 'plan_proposals', 'plan_decisions']) as t;
select throws_ok(format('update public.%I set user_id = user_id', t), '42501', null, 'athlete cannot update ' || t)
from unnest(array['training_plans', 'plan_versions', 'plan_blocks', 'plan_weeks', 'plan_sessions', 'plan_proposals', 'plan_decisions']) as t;
reset role;

create function pg_temp.plan_rows_digest()
returns text
language sql
as $$
  select concat_ws('|',
    (select string_agg(r::text, ',' order by r.id) from public.training_plans r),
    (select string_agg(r::text, ',' order by r.id) from public.plan_sessions r),
    (select string_agg(r::text, ',' order by r.id) from public.plan_proposals r),
    (select string_agg(r::text, ',' order by r.id) from public.plan_decisions r)
  );
$$;

create temp table plan_snapshot as select pg_temp.plan_rows_digest() as digest;

select pg_temp.act_as('b1000000-0000-4000-8000-0000000000b1');
select is(
  (select array[
    (select count(*) from public.training_plans),
    (select count(*) from public.plan_versions),
    (select count(*) from public.plan_blocks),
    (select count(*) from public.plan_weeks),
    (select count(*) from public.plan_sessions),
    (select count(*) from public.plan_proposals),
    (select count(*) from public.plan_decisions)
  ]::int[]),
  array[0, 0, 0, 0, 0, 0, 0], 'another athlete reads none of the plan rows'
);
select throws_ok(
  $$select public.reject_plan_proposal('10000000-0000-4000-8000-000000000009')$$,
  'PT404', 'not_found', 'another athlete cannot decide a foreign proposal'
);
select throws_ok(
  $$update public.training_plans set title = 'Volé' where user_id = 'a1000000-0000-4000-8000-0000000000a1'$$,
  '42501', null, 'another athlete cannot update a foreign plan'
);
select throws_ok(
  $$update public.plan_sessions set scheduled_on = current_date + 30$$,
  '42501', null, 'another athlete cannot update foreign sessions'
);
select throws_ok(
  $$update public.plan_proposals set status = 'accepted'$$,
  '42501', null, 'another athlete cannot update foreign proposals'
);
select throws_ok(
  $$delete from public.plan_decisions$$,
  '42501', null, 'another athlete cannot delete foreign decisions'
);
select throws_ok(
  $$insert into public.plan_sessions (plan_id, user_id, session_key, valid_from_version, scheduled_on, sport, kind, title, purpose, is_key, priority, targets, structure, origin)
    values ((select plan_id from public.plan_proposals limit 1), 'a1000000-0000-4000-8000-0000000000a1', 's-7', 4, current_date + 8, 'run', 'easy', 'Footing', 'Endurance', false, 'normal', '{}', '[]', 'athlete')$$,
  '42501', null, 'another athlete cannot insert into a foreign plan'
);
reset role;

select ok(
  (select digest = pg_temp.plan_rows_digest() from plan_snapshot),
  'foreign write attempts leave plans, sessions, proposals and decisions unchanged'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.training_plans$$,
  '42501', null, 'anonymous visitors have no access'
);
reset role;

insert into public.plan_proposals (id, user_id, scope, origin, requested_by, status, title, operations)
values ('10000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-0000000000a1',
  'new_plan', 'race', 'athlete', 'accepted', 'Plan suivant', '[]');

set local role stride_coach_worker;
select is(
  (private.apply_plan_proposal('10000000-0000-4000-8000-000000000010', pg_temp.creation('Plan B'))).version,
  1, 'a second plan starts at version 1'
);
reset role;

select is(
  (select array_agg(title || ':' || status order by title) from public.training_plans),
  array['Plan A:archived', 'Plan B:active'], 'creating a plan archives the previous active plan'
);
select is(
  pg_temp.sessions_at(3), 's-1@5,s-2@-3', 'archived plan history stays readable'
);

select * from finish();

rollback;
