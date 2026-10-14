begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

grant usage on schema extensions to stride_coach_worker;

insert into auth.users (id, aud, role, email) values
  ('a3000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'delete-a@example.com'),
  ('b3000000-0000-4000-8000-0000000000b3', 'authenticated', 'authenticated', 'delete-b@example.com');

insert into public.training_plans (id, user_id, title, starts_on, ends_on, active_version, time_zone)
values
  ('30000000-0000-4000-8000-0000000000a3', 'a3000000-0000-4000-8000-0000000000a3', 'Plan A',
    current_date, current_date + 70, 1, 'Europe/Paris');

insert into public.plan_proposals (user_id, plan_id, base_version, scope, origin, requested_by, status, title, operations)
values
  ('a3000000-0000-4000-8000-0000000000a3', '30000000-0000-4000-8000-0000000000a3', 1,
    'session', 'training', 'athlete', 'ready', 'Séance', '[]'),
  ('a3000000-0000-4000-8000-0000000000a3', null, null,
    'new_plan', 'training', 'athlete', 'ready', 'Nouveau plan', '[]');

select ok(
  has_function_privilege('stride_coach_worker', 'private.delete_plan(uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'private.delete_plan(uuid, uuid)', 'execute')
    and not has_function_privilege('service_role', 'private.delete_plan(uuid, uuid)', 'execute')
    and not has_function_privilege('anon', 'private.delete_plan(uuid, uuid)', 'execute'),
  'only the coach worker may delete plans'
);

set local role stride_coach_worker;
select throws_ok(
  $$select private.delete_plan('b3000000-0000-4000-8000-0000000000b3', '30000000-0000-4000-8000-0000000000a3')$$,
  'PT404', 'not_found', 'a plan cannot be deleted under another athlete'
);
select is(
  private.delete_plan('a3000000-0000-4000-8000-0000000000a3', '30000000-0000-4000-8000-0000000000a3'),
  1, 'the owner plan is deleted'
);
reset role;

select is(
  (select count(*)::integer from public.training_plans where user_id = 'a3000000-0000-4000-8000-0000000000a3'),
  0, 'no plan remains'
);
select is(
  (select count(*)::integer from public.plan_proposals where user_id = 'a3000000-0000-4000-8000-0000000000a3'),
  0, 'plan proposals and pending new plan proposals are removed'
);
select throws_ok(
  $$select private.delete_plan('a3000000-0000-4000-8000-0000000000a3', '30000000-0000-4000-8000-0000000000a3')$$,
  'PT404', 'not_found', 'deleting twice reports not found'
);

select * from finish();
rollback;
