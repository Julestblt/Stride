begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

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
  (select time_zone from public.athlete_profiles),
  'Europe/Paris', 'time zone defaults to Europe/Paris'
);
select lives_ok(
  $$update public.athlete_profiles set time_zone = 'America/Argentina/Buenos_Aires', max_weekly_minutes = 420
    where user_id = 'e0000000-0000-4000-8000-00000000000e'$$,
  'athlete may set a time zone and a weekly ceiling'
);
select throws_ok(
  $$update public.athlete_profiles set time_zone = 'Paris; drop table x'
    where user_id = 'e0000000-0000-4000-8000-00000000000e'$$,
  '23514', null, 'malformed time zone is rejected'
);
select throws_ok(
  $$update public.athlete_profiles set max_weekly_minutes = 30
    where user_id = 'e0000000-0000-4000-8000-00000000000e'$$,
  '23514', null, 'weekly ceiling below one hour is rejected'
);
select lives_ok(
  $$insert into public.athlete_unavailability (user_id, starts_on, ends_on, kind, reason)
    values ('e0000000-0000-4000-8000-00000000000e', '2026-11-10', '2026-11-16', 'travel', 'Congrès')$$,
  'athlete may add an unavailable period'
);
select throws_ok(
  $$insert into public.athlete_unavailability (user_id, starts_on, ends_on)
    values ('e0000000-0000-4000-8000-00000000000e', '2026-11-16', '2026-11-10')$$,
  '23514', null, 'a period ending before it starts is rejected'
);
select throws_ok(
  $$insert into public.athlete_unavailability (user_id, starts_on, ends_on, kind)
    values ('e0000000-0000-4000-8000-00000000000e', '2026-11-10', '2026-11-12', 'injury')$$,
  '23514', null, 'unknown kind is rejected'
);
select throws_ok(
  $$insert into public.athlete_unavailability (user_id, starts_on, ends_on)
    values ('f0000000-0000-4000-8000-00000000000f', '2026-11-10', '2026-11-12')$$,
  '42501', null, 'athlete cannot add a period for another athlete'
);
update public.athlete_unavailability set ends_on = '2026-11-17';
select is(
  (select revision from public.athlete_unavailability),
  2, 'updates advance the revision'
);
reset role;

select pg_temp.act_as('f0000000-0000-4000-8000-00000000000f');
select is((select count(*) from public.athlete_unavailability)::int, 0, 'other athlete cannot read periods');
update public.athlete_unavailability set ends_on = '2026-12-31';
delete from public.athlete_unavailability;
reset role;

select is(
  (select ends_on from public.athlete_unavailability
    where user_id = 'e0000000-0000-4000-8000-00000000000e'),
  '2026-11-17'::date, 'other athlete cannot change or delete periods'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.athlete_unavailability$$,
  '42501', null, 'anonymous visitors have no access'
);
reset role;

select pg_temp.act_as('e0000000-0000-4000-8000-00000000000e');
select lives_ok(
  $$delete from public.athlete_unavailability$$,
  'athlete may delete their own periods'
);
select is((select count(*) from public.athlete_unavailability)::int, 0, 'deleted period is gone');
reset role;

select * from finish();

rollback;
