begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, aud, role, email) values
  ('a5000000-0000-4000-8000-0000000000a5', 'authenticated', 'authenticated', 'thread-a@example.com'),
  ('b5000000-0000-4000-8000-0000000000b5', 'authenticated', 'authenticated', 'thread-b@example.com');

insert into public.coach_sessions (id, user_id, managed_session_id, mode, budget_cents, title)
values
  ('a5000000-0000-4000-8000-00000000c0a5', 'a5000000-0000-4000-8000-0000000000a5',
    'sesn_01ThreadA', 'conversation', 100, 'Genou en descente'),
  ('b5000000-0000-4000-8000-00000000c0b5', 'b5000000-0000-4000-8000-0000000000b5',
    'sesn_01ThreadB', 'conversation', 100, 'Autre fil');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select ok(rowsecurity, 'coach thread items have RLS enabled')
from pg_tables
where schemaname = 'public' and tablename = 'coach_thread_items';

set local role anon;
select throws_ok(
  'select * from public.coach_thread_items', '42501', null,
  'anonymous user cannot read thread items'
);
reset role;

select pg_temp.act_as('a5000000-0000-4000-8000-0000000000a5');
select lives_ok(
  $$insert into public.coach_thread_items (user_id, coach_session_id, kind, body)
    values ('a5000000-0000-4000-8000-0000000000a5', 'a5000000-0000-4000-8000-00000000c0a5',
      'athlete', '{"text": "J''ai mal au genou"}')$$,
  'athlete records an item in their own thread'
);
select throws_ok(
  $$insert into public.coach_thread_items (user_id, coach_session_id, kind, body)
    values ('a5000000-0000-4000-8000-0000000000a5', 'b5000000-0000-4000-8000-00000000c0b5',
      'coach', '{"text": "Intrus"}')$$,
  '42501', null, 'athlete cannot write into another athlete''s thread'
);
select throws_ok(
  $$insert into public.coach_thread_items (user_id, coach_session_id, kind, body)
    values ('a5000000-0000-4000-8000-0000000000a5', 'a5000000-0000-4000-8000-00000000c0a5',
      'unknown', '{}')$$,
  '23514', null, 'unknown item kinds are rejected'
);
select throws_ok(
  $$update public.coach_thread_items set body = '{"text": "Réécrit"}'$$,
  '42501', null, 'thread items are append-only'
);
select lives_ok(
  $$update public.coach_sessions set read_at = now(), last_activity_at = now()
    where id = 'a5000000-0000-4000-8000-00000000c0a5'$$,
  'athlete marks their thread as read'
);
select throws_ok(
  $$update public.coach_sessions set title = 'Renommé'$$,
  '42501', null, 'the title is fixed at creation'
);
select is(
  (select count(*)::int from public.coach_thread_items), 1,
  'athlete reads their own items'
);

select pg_temp.act_as('b5000000-0000-4000-8000-0000000000b5');
select is(
  (select count(*)::int from public.coach_thread_items), 0,
  'another athlete sees no thread items'
);
select is(
  (select count(*)::int from public.coach_sessions where title = 'Genou en descente'), 0,
  'another athlete sees no foreign thread title'
);
select throws_ok(
  $$insert into public.coach_thread_items (user_id, coach_session_id, kind, body)
    values ('a5000000-0000-4000-8000-0000000000a5', 'a5000000-0000-4000-8000-00000000c0a5',
      'coach', '{"text": "Usurpé"}')$$,
  '42501', null, 'another athlete cannot write items as the owner'
);
reset role;

select * from finish();
rollback;
