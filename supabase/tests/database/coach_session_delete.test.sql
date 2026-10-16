begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, aud, role, email) values
  ('a6000000-0000-4000-8000-0000000000a6', 'authenticated', 'authenticated', 'delete-a@example.com'),
  ('b6000000-0000-4000-8000-0000000000b6', 'authenticated', 'authenticated', 'delete-b@example.com');

insert into public.coach_sessions (id, user_id, managed_session_id, mode, budget_cents, title)
values ('a6000000-0000-4000-8000-00000000c0a6', 'a6000000-0000-4000-8000-0000000000a6',
  'sesn_01DeleteA', 'conversation', 100, 'Genou');

insert into public.coach_thread_items (user_id, coach_session_id, kind, body)
values ('a6000000-0000-4000-8000-0000000000a6', 'a6000000-0000-4000-8000-00000000c0a6',
  'athlete', '{"text": "Salut", "consult": null}');

insert into public.plan_proposals (id, user_id, plan_id, base_version, scope, origin, requested_by,
  status, title, operations, coach_session_id)
values ('a6000000-0000-4000-8000-0000000000e6', 'a6000000-0000-4000-8000-0000000000a6', null, null,
  'new_plan', 'training', 'athlete', 'ready', 'Nouveau plan', '[]',
  'a6000000-0000-4000-8000-00000000c0a6');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('b6000000-0000-4000-8000-0000000000b6');
delete from public.coach_sessions where id = 'a6000000-0000-4000-8000-00000000c0a6';
reset role;
select is(
  (select count(*)::int from public.coach_sessions where id = 'a6000000-0000-4000-8000-00000000c0a6'), 1,
  'another athlete cannot delete the conversation'
);

set local role anon;
select throws_ok(
  $$delete from public.coach_sessions$$, '42501', null,
  'anonymous user cannot delete conversations'
);
reset role;

select pg_temp.act_as('a6000000-0000-4000-8000-0000000000a6');
select lives_ok(
  $$delete from public.coach_sessions where id = 'a6000000-0000-4000-8000-00000000c0a6'$$,
  'the owner deletes their conversation'
);
reset role;

select is(
  (select count(*)::int from public.coach_sessions where id = 'a6000000-0000-4000-8000-00000000c0a6'), 0,
  'the conversation is gone'
);
select is(
  (select count(*)::int from public.coach_thread_items
    where coach_session_id = 'a6000000-0000-4000-8000-00000000c0a6'), 0,
  'its items are deleted with it'
);
select is(
  (select coach_session_id from public.plan_proposals where id = 'a6000000-0000-4000-8000-0000000000e6'), null,
  'its proposals stay, detached from the conversation'
);

select * from finish();
rollback;
