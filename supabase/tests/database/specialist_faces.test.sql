begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, aud, role, email) values
  ('e1000000-0000-4000-8000-00000000000e', 'authenticated', 'authenticated', 'e1@example.com'),
  ('f1000000-0000-4000-8000-00000000000f', 'authenticated', 'authenticated', 'f1@example.com');

create function pg_temp.act_as(p_user uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('e1000000-0000-4000-8000-00000000000e');
insert into public.athlete_profiles (user_id) values ('e1000000-0000-4000-8000-00000000000e');
select is(
  (select director_face || ',' || strategist_face || ',' || nutritionist_face
    from public.athlete_profiles),
  'marc,hugo,lea', 'new athletes get the default specialist faces'
);
select lives_ok(
  $$update public.athlete_profiles
    set director_face = 'sophie', strategist_face = 'nadia', nutritionist_face = 'yanis'
    where user_id = 'e1000000-0000-4000-8000-00000000000e'$$,
  'athlete may choose the specialist faces'
);
select throws_ok(
  $$update public.athlete_profiles set nutritionist_face = 'hugo'
    where user_id = 'e1000000-0000-4000-8000-00000000000e'$$,
  '23514', null, 'a face from another role is rejected'
);
reset role;

select pg_temp.act_as('f1000000-0000-4000-8000-00000000000f');
update public.athlete_profiles set director_face = 'marc'
  where user_id = 'e1000000-0000-4000-8000-00000000000e';
select is((select count(*) from public.athlete_profiles)::int, 0, 'other athlete cannot read the faces');
reset role;

select is(
  (select director_face || ',' || strategist_face || ',' || nutritionist_face
    from public.athlete_profiles
    where user_id = 'e1000000-0000-4000-8000-00000000000e'),
  'sophie,nadia,yanis', 'other athlete cannot change the faces'
);

select * from finish();

rollback;
