begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, aud, role, email) values
  ('c0000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'c@example.com'),
  ('d0000000-0000-4000-8000-00000000000d', 'authenticated', 'authenticated', 'd@example.com');

create function pg_temp.act_as(p_user uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('c0000000-0000-4000-8000-00000000000c');
insert into public.athlete_profiles (user_id) values ('c0000000-0000-4000-8000-00000000000c');
select lives_ok(
  $$update public.athlete_profiles set running_max_heart_rate_override = 185
    where user_id = 'c0000000-0000-4000-8000-00000000000c'$$,
  'athlete may update their running maximum'
);
select is(
  (select running_max_heart_rate_override from public.athlete_profiles)::int,
  185, 'athlete reads their saved running maximum'
);
select throws_ok(
  $$update public.athlete_profiles set running_max_heart_rate_override = 99
    where user_id = 'c0000000-0000-4000-8000-00000000000c'$$,
  '23514', null, 'out-of-range override is rejected'
);
reset role;

select pg_temp.act_as('d0000000-0000-4000-8000-00000000000d');
select is((select count(*) from public.athlete_profiles)::int, 0, 'other athlete cannot read the override');
update public.athlete_profiles set running_max_heart_rate_override = 200
  where user_id = 'c0000000-0000-4000-8000-00000000000c';
reset role;

select is(
  (select running_max_heart_rate_override from public.athlete_profiles
    where user_id = 'c0000000-0000-4000-8000-00000000000c')::int,
  185, 'other athlete cannot change the override'
);

select * from finish();

rollback;
