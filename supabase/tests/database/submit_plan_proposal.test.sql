begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, aud, role, email) values
  ('a2000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'submit-a@example.com'),
  ('b2000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'submit-b@example.com');

insert into public.training_plans (id, user_id, title, starts_on, ends_on, active_version, time_zone)
values
  ('20000000-0000-4000-8000-0000000000a2', 'a2000000-0000-4000-8000-0000000000a2', 'Plan A',
    current_date, current_date + 70, 3, 'Europe/Paris');

create function pg_temp.act_as(p_user uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.submit(
  p_plan_id uuid,
  p_base_version integer,
  p_keys text[] default array['s-1'],
  p_scope text default 'session'
)
returns public.plan_proposals
language sql
as $$
  select public.submit_plan_proposal(
    p_scope, 'recovery', 'Séance allégée', 'Résumé', 'Raison',
    '[{"op": "skip_session", "sessionKey": "s-1"}]', '{"plan": null}',
    p_plan_id, p_base_version,
    '[{"specialist": "medical", "verdict": "compatible", "summary": "ok"}]', p_keys
  );
$$;

select pg_temp.act_as('a2000000-0000-4000-8000-0000000000a2');

select is(
  (pg_temp.submit('20000000-0000-4000-8000-0000000000a2', 3)).status,
  'ready', 'athlete submits a ready proposal on their active plan'
);
select is(
  (select requested_by || ':' || user_id::text from public.plan_proposals),
  'athlete:a2000000-0000-4000-8000-0000000000a2',
  'proposal belongs to the caller'
);
select is(
  (pg_temp.submit('20000000-0000-4000-8000-0000000000a2', 3, array['s-1', 's-1'])).target_keys,
  array['s-1'], 'target keys are deduplicated'
);
select is(
  (select count(*)::integer from public.plan_proposals where status = 'superseded'
    and superseded_by = (select id from public.plan_proposals where status = 'ready')),
  1, 'a new proposal on the same targets supersedes the ready one'
);
select throws_ok(
  $$select pg_temp.submit('20000000-0000-4000-8000-0000000000a2', 2)$$,
  'PT409', 'stale_version', 'proposal on an old version is refused'
);
select throws_ok(
  $$select pg_temp.submit('20000000-0000-4000-8000-0000000000a2', 3, array['s-1'], 'undo')$$,
  'PT400', 'invalid_scope', 'undo scope is refused'
);
select is(
  (pg_temp.submit(null, null, array['plan'], 'new_plan')).scope,
  'new_plan', 'athlete submits a new plan proposal'
);
reset role;

select pg_temp.act_as('b2000000-0000-4000-8000-0000000000b2');
select throws_ok(
  $$select pg_temp.submit('20000000-0000-4000-8000-0000000000a2', 3)$$,
  'PT404', 'not_found', 'athlete cannot propose on another athlete plan'
);
select is(
  (select count(*)::integer from public.plan_proposals),
  0, 'athlete sees none of another athlete proposals'
);
reset role;

select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$select pg_temp.submit('20000000-0000-4000-8000-0000000000a2', 3)$$,
  'PT401', 'not_authenticated', 'anonymous callers are refused'
);

select ok(
  has_function_privilege('authenticated',
    'public.submit_plan_proposal(text, text, text, text, text, jsonb, jsonb, uuid, integer, jsonb, text[], uuid)', 'execute')
    and not has_function_privilege('anon',
      'public.submit_plan_proposal(text, text, text, text, text, jsonb, jsonb, uuid, integer, jsonb, text[], uuid)', 'execute')
    and not has_function_privilege('service_role',
      'public.submit_plan_proposal(text, text, text, text, text, jsonb, jsonb, uuid, integer, jsonb, text[], uuid)', 'execute'),
  'only athletes may submit proposals'
);
select is(
  (select count(*)::integer from public.plan_proposals),
  3, 'three proposals were stored'
);

select * from finish();
rollback;
