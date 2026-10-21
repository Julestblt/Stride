begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, aud, role, email) values
  ('a3000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'choices-a@example.com'),
  ('b3000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'choices-b@example.com');

insert into public.athlete_shoes
  (id, user_id, brand, model, category, terrain, lifespan_km, first_use_date)
values
  ('a3000000-0000-4000-8000-0000000000a1', 'a3000000-0000-4000-8000-00000000000a',
   'Adidas', 'Adizero Evo SL', 'daily', 'road', 800, '2026-06-02'),
  ('a3000000-0000-4000-8000-0000000000a2', 'a3000000-0000-4000-8000-00000000000a',
   'Salomon', 'Ultra Glide', 'recovery', 'trail', 700, '2026-05-01'),
  ('b3000000-0000-4000-8000-0000000000b1', 'b3000000-0000-4000-8000-00000000000b',
   'Nike', 'Zegama', 'daily', 'trail', 700, '2026-05-01');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select ok(rowsecurity, 'shoe choices have RLS enabled')
from pg_tables where schemaname = 'public' and tablename = 'plan_session_shoe_choices';

set local role anon;
select throws_ok('select * from public.plan_session_shoe_choices', '42501', null,
  'anonymous user cannot read shoe choices');
reset role;

select pg_temp.act_as('a3000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$insert into public.plan_session_shoe_choices (user_id, session_key, shoe_id)
    values ('a3000000-0000-4000-8000-00000000000a', 's-2026-10-22-1',
      'a3000000-0000-4000-8000-0000000000a1')$$,
  'athlete picks a pair for a session'
);
select lives_ok(
  $$insert into public.plan_session_shoe_choices (user_id, session_key, shoe_id)
    values ('a3000000-0000-4000-8000-00000000000a', 's-2026-10-22-1',
      'a3000000-0000-4000-8000-0000000000a2')
    on conflict (user_id, session_key)
    do update set user_id = excluded.user_id, session_key = excluded.session_key,
      shoe_id = excluded.shoe_id, updated_at = now()$$,
  'athlete changes the pair of the same session'
);
select is(
  (select shoe_id from public.plan_session_shoe_choices where session_key = 's-2026-10-22-1'),
  'a3000000-0000-4000-8000-0000000000a2'::uuid,
  'one choice is kept per session key'
);
select throws_ok(
  $$insert into public.plan_session_shoe_choices (user_id, session_key, shoe_id)
    values ('a3000000-0000-4000-8000-00000000000a', 's-2026-10-23-1',
      'b3000000-0000-4000-8000-0000000000b1')$$,
  '23503', null, 'athlete cannot pick another athlete''s pair'
);
select throws_ok(
  $$insert into public.plan_session_shoe_choices (user_id, session_key, shoe_id)
    values ('b3000000-0000-4000-8000-00000000000b', 's-2026-10-23-1',
      'b3000000-0000-4000-8000-0000000000b1')$$,
  '42501', null, 'athlete cannot pick a pair for someone else'
);
reset role;

select pg_temp.act_as('b3000000-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.plan_session_shoe_choices), 0,
  'another athlete sees no choice');
reset role;

delete from public.athlete_shoes where id = 'a3000000-0000-4000-8000-0000000000a2';
select is((select count(*)::int from public.plan_session_shoe_choices), 0,
  'deleting a pair removes its choices');

select throws_ok(
  $$insert into public.plan_session_shoe_choices (user_id, session_key, shoe_id)
    values ('a3000000-0000-4000-8000-00000000000a', 'Mardi',
      'a3000000-0000-4000-8000-0000000000a1')$$,
  '23514', null, 'the session key keeps the plan key format'
);

select * from finish();
rollback;
