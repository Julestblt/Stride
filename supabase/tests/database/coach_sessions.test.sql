begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

grant usage on schema extensions to stride_coach_worker;

insert into auth.users (id, aud, role, email) values
  ('a4000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'coach-a@example.com'),
  ('b4000000-0000-4000-8000-0000000000b4', 'authenticated', 'authenticated', 'coach-b@example.com');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select ok(rowsecurity, 'coach sessions have RLS enabled')
from pg_tables
where schemaname = 'public' and tablename = 'coach_sessions';

set local role anon;
select throws_ok(
  'select * from public.coach_sessions', '42501', null,
  'anonymous user cannot read coach sessions'
);
reset role;

select pg_temp.act_as('a4000000-0000-4000-8000-0000000000a4');
select lives_ok(
  $$insert into public.coach_sessions (user_id, managed_session_id, mode, budget_cents)
    values ('a4000000-0000-4000-8000-0000000000a4', 'sesn_01AthleteA', 'conversation', 100)$$,
  'athlete records their own session'
);
select throws_ok(
  $$insert into public.coach_sessions (user_id, managed_session_id, mode, budget_cents)
    values ('b4000000-0000-4000-8000-0000000000b4', 'sesn_01Forged', 'conversation', 100)$$,
  '42501', null, 'athlete cannot record a session for another athlete'
);
select throws_ok(
  $$insert into public.coach_sessions (user_id, managed_session_id, mode, budget_cents)
    values ('a4000000-0000-4000-8000-0000000000a4', 'not-a-session', 'conversation', 100)$$,
  '23514', null, 'malformed session ids are rejected'
);
select lives_ok(
  $$update public.coach_sessions
    set status = 'awaiting_athlete', pending_tool_use_id = 'sevt_01Question', list_cost_cents = 12
    where managed_session_id = 'sesn_01AthleteA'$$,
  'athlete session pauses on a question'
);
select throws_ok(
  $$update public.coach_sessions set status = 'awaiting_athlete', pending_tool_use_id = null
    where managed_session_id = 'sesn_01AthleteA'$$,
  '23514', null, 'a paused session must keep its pending question'
);
select throws_ok(
  $$update public.coach_sessions set user_id = 'b4000000-0000-4000-8000-0000000000b4'$$,
  '42501', null, 'a session cannot be handed to another athlete'
);
select throws_ok(
  $$update public.coach_sessions set budget_cents = 100000$$,
  '42501', null, 'the budget is not writable after creation'
);

select pg_temp.act_as('b4000000-0000-4000-8000-0000000000b4');
select is(
  (select count(*)::int from public.coach_sessions), 0,
  'another athlete sees no coach sessions'
);
select throws_ok(
  $$insert into public.coach_sessions (user_id, managed_session_id, mode, budget_cents)
    values ('b4000000-0000-4000-8000-0000000000b4', 'sesn_01AthleteA', 'conversation', 100)$$,
  '23505', null, 'another athlete cannot claim an existing session id'
);
reset role;

select ok(
  has_function_privilege('stride_coach_worker', 'private.clear_new_plan_proposals(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'private.clear_new_plan_proposals(uuid)', 'execute')
    and not has_function_privilege('service_role', 'private.clear_new_plan_proposals(uuid)', 'execute'),
  'only the coach worker may clear pending new plan proposals'
);

insert into public.plan_proposals (user_id, plan_id, base_version, scope, origin, requested_by, status, title, operations)
values
  ('a4000000-0000-4000-8000-0000000000a4', null, null,
    'new_plan', 'training', 'athlete', 'ready', 'Nouveau plan', '[]'),
  ('b4000000-0000-4000-8000-0000000000b4', null, null,
    'new_plan', 'training', 'athlete', 'ready', 'Autre plan', '[]');

set local role stride_coach_worker;
select is(
  private.clear_new_plan_proposals('a4000000-0000-4000-8000-0000000000a4'),
  1, 'pending new plan proposals are cleared without an active plan, for that athlete only'
);
reset role;

select * from finish();
rollback;
