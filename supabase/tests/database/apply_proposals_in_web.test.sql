begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, aud, role, email) values
  ('a5000000-0000-4000-8000-0000000000a5', 'authenticated', 'authenticated', 'web-apply-a@example.com'),
  ('b5000000-0000-4000-8000-0000000000b5', 'authenticated', 'authenticated', 'web-apply-b@example.com');

insert into public.training_plans (id, user_id, title, starts_on, ends_on, active_version, time_zone)
values
  ('50000000-0000-4000-8000-0000000000a5', 'a5000000-0000-4000-8000-0000000000a5', 'Plan A',
    current_date, current_date + 70, 2, 'Europe/Paris');

insert into public.plan_proposals (
  id, user_id, plan_id, base_version, scope, origin, requested_by, status, title, operations,
  target_keys
)
values
  ('51000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-0000000000a5',
    '50000000-0000-4000-8000-0000000000a5', 2, 'session', 'recovery', 'athlete', 'accepted',
    'Séance allégée', '[]', array['s-1']),
  ('51000000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-0000000000a5',
    null, null, 'new_plan', 'training', 'athlete', 'ready',
    'Nouveau plan', '[]', array['plan']);

create function pg_temp.act_as(p_user uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select ok(
  has_function_privilege('authenticated', 'public.apply_accepted_plan_proposal(uuid, jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.record_plan_proposal_outcome(uuid, text, text)', 'execute')
    and has_function_privilege('authenticated', 'public.reset_own_plan(uuid)', 'execute'),
  'athletes may call the apply, outcome and reset RPCs'
);
select ok(
  not has_function_privilege('anon', 'public.apply_accepted_plan_proposal(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.record_plan_proposal_outcome(uuid, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.reset_own_plan(uuid)', 'execute')
    and not has_function_privilege('service_role', 'public.apply_accepted_plan_proposal(uuid, jsonb)', 'execute')
    and not has_function_privilege('service_role', 'public.record_plan_proposal_outcome(uuid, text, text)', 'execute')
    and not has_function_privilege('service_role', 'public.reset_own_plan(uuid)', 'execute'),
  'no other API role may call the apply, outcome and reset RPCs'
);

select pg_temp.act_as('b5000000-0000-4000-8000-0000000000b5');
select throws_ok(
  $$select public.apply_accepted_plan_proposal('51000000-0000-4000-8000-000000000001',
    '{"plan": null, "blocks": {"closed": [], "added": []}, "weeks": {"closed": [], "added": []}, "sessions": {"closed": [], "added": []}}')$$,
  'PT404', 'not_found', 'an athlete cannot apply another athlete proposal'
);
select throws_ok(
  $$select public.record_plan_proposal_outcome('51000000-0000-4000-8000-000000000001', 'stale', null)$$,
  'PT404', 'not_found', 'an athlete cannot record an outcome on another athlete proposal'
);
select throws_ok(
  $$select public.reset_own_plan('50000000-0000-4000-8000-0000000000a5')$$,
  'PT404', 'not_found', 'an athlete cannot delete another athlete plan'
);
select lives_ok(
  $$select public.reset_own_plan()$$,
  'clearing new plan proposals only touches the caller'
);
reset role;

select is(
  (select count(*)::integer from public.plan_proposals where user_id = 'a5000000-0000-4000-8000-0000000000a5'),
  2, 'another athlete leaves the owner proposals untouched'
);

select pg_temp.act_as('a5000000-0000-4000-8000-0000000000a5');
select throws_ok(
  $$select public.apply_accepted_plan_proposal('51000000-0000-4000-8000-000000000001', '{}')$$,
  'PT400', 'invalid_changeset', 'the owner apply reaches the validated private function'
);
select throws_ok(
  $$select public.apply_accepted_plan_proposal('51000000-0000-4000-8000-000000000002',
    '{"plan": null, "blocks": {"closed": [], "added": []}, "weeks": {"closed": [], "added": []}, "sessions": {"closed": [], "added": []}}')$$,
  'PT409', 'invalid_state', 'a proposal the athlete has not accepted cannot be applied'
);
select lives_ok(
  $$select public.record_plan_proposal_outcome('51000000-0000-4000-8000-000000000001', 'stale', 'stale_version')$$,
  'the owner records a stale outcome'
);
reset role;

select is(
  (select status from public.plan_proposals where id = '51000000-0000-4000-8000-000000000001'),
  'stale', 'the accepted proposal is marked stale'
);

select pg_temp.act_as('a5000000-0000-4000-8000-0000000000a5');
select lives_ok(
  $$select public.reset_own_plan()$$,
  'the owner clears pending new plan proposals'
);
select lives_ok(
  $$select public.reset_own_plan('50000000-0000-4000-8000-0000000000a5')$$,
  'the owner deletes their plan'
);
reset role;

select is(
  (select array[
    (select count(*) from public.training_plans where user_id = 'a5000000-0000-4000-8000-0000000000a5'),
    (select count(*) from public.plan_proposals where id = '51000000-0000-4000-8000-000000000002')
  ]::int[]),
  array[0, 0], 'reset removes the plan and the pending new plan proposal'
);

select * from finish();
rollback;
