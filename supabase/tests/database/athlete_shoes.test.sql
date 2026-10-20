begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, aud, role, email) values
  ('a2000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'shoes-a@example.com'),
  ('b2000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'shoes-b@example.com');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select ok(rowsecurity, 'shoes have RLS enabled')
from pg_tables where schemaname = 'public' and tablename = 'athlete_shoes';

set local role anon;
select throws_ok('select * from public.athlete_shoes', '42501', null,
  'anonymous user cannot read shoes');
reset role;

select pg_temp.act_as('a2000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$insert into public.athlete_shoes
      (user_id, garmin_gear_uuid, brand, model, version, category, terrain,
       lifespan_km, starting_distance_m, first_use_date)
    values ('a2000000-0000-4000-8000-00000000000a', 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
      'Adidas', 'Adizero Evo SL', '3', 'daily', 'road', 800, 412000, '2026-06-02')$$,
  'athlete adds a pair'
);
select lives_ok(
  $$update public.athlete_shoes set retired_on = '2026-10-20'$$,
  'athlete retires the pair'
);
select is((select revision from public.athlete_shoes), 2, 'an update advances the revision');
select throws_ok(
  $$update public.athlete_shoes set retired_on = '2026-01-01'$$,
  '23514', null, 'a pair cannot be retired before its first use'
);
select throws_ok(
  $$insert into public.athlete_shoes
      (user_id, brand, model, category, terrain, lifespan_km, first_use_date)
    values ('b2000000-0000-4000-8000-00000000000b', 'Nike', 'Zegama', 'daily', 'trail', 700, '2026-05-01')$$,
  '42501', null, 'athlete cannot add a pair for someone else'
);
reset role;

select pg_temp.act_as('b2000000-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.athlete_shoes), 0, 'another athlete sees no pair');
select throws_ok(
  $$update public.athlete_shoes set revision = 9$$,
  '42501', null, 'the revision is not writable'
);
reset role;

select * from finish();
rollback;
