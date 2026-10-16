begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, aud, role, email) values
  ('e0000000-0000-4000-8000-00000000000e', 'authenticated', 'authenticated', 'e@example.com'),
  ('f0000000-0000-4000-8000-00000000000f', 'authenticated', 'authenticated', 'f@example.com');

create function pg_temp.act_as(p_user uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('e0000000-0000-4000-8000-00000000000e');
insert into public.athlete_profiles (user_id) values ('e0000000-0000-4000-8000-00000000000e');
select is(
  (select coach_face || ',' || medical_face from public.athlete_profiles),
  'claire,ines', 'new athletes get the default faces'
);
select lives_ok(
  $$update public.athlete_profiles set coach_face = 'thomas', medical_face = 'karim'
    where user_id = 'e0000000-0000-4000-8000-00000000000e'$$,
  'athlete may choose their staff faces'
);
select is(
  (select coach_face || ',' || medical_face from public.athlete_profiles),
  'thomas,karim', 'athlete reads their chosen faces'
);
select throws_ok(
  $$update public.athlete_profiles set coach_face = 'marc'
    where user_id = 'e0000000-0000-4000-8000-00000000000e'$$,
  '23514', null, 'unknown face is rejected'
);
reset role;

select pg_temp.act_as('f0000000-0000-4000-8000-00000000000f');
select is((select count(*) from public.athlete_profiles)::int, 0, 'other athlete cannot read the faces');
update public.athlete_profiles set coach_face = 'claire'
  where user_id = 'e0000000-0000-4000-8000-00000000000e';
reset role;

select is(
  (select coach_face from public.athlete_profiles
    where user_id = 'e0000000-0000-4000-8000-00000000000e'),
  'thomas', 'other athlete cannot change the faces'
);

select * from finish();

rollback;
