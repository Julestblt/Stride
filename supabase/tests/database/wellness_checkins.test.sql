begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, aud, role, email) values
  ('e0000000-0000-4000-8000-00000000000e', 'authenticated', 'authenticated', 'well-e@example.com'),
  ('f0000000-0000-4000-8000-00000000000f', 'authenticated', 'authenticated', 'well-f@example.com');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select ok(rowsecurity, 'wellness check-ins have RLS enabled')
from pg_tables
where schemaname = 'public' and tablename = 'athlete_wellness_checkins';

set local role anon;
select throws_ok(
  'select * from public.athlete_wellness_checkins', '42501', null,
  'anonymous user cannot read check-ins'
);
reset role;

select pg_temp.act_as('e0000000-0000-4000-8000-00000000000e');
select lives_ok(
  $$insert into public.athlete_wellness_checkins (user_id, checkin_date, legs)
    values ('e0000000-0000-4000-8000-00000000000e', '2026-10-12', 'fresh')
    on conflict (user_id, checkin_date) do update set legs = excluded.legs$$,
  'athlete records today''s legs'
);
select lives_ok(
  $$insert into public.athlete_wellness_checkins (user_id, checkin_date, stress)
    values ('e0000000-0000-4000-8000-00000000000e', '2026-10-12', 'high')
    on conflict (user_id, checkin_date) do update
      set user_id = excluded.user_id, checkin_date = excluded.checkin_date,
        stress = excluded.stress$$,
  'a second answer updates the same day'
);
select is(
  (select legs || '/' || stress || '/' || revision
    from public.athlete_wellness_checkins where checkin_date = '2026-10-12'),
  'fresh/high/2', 'both answers are kept and the revision advances'
);
select throws_ok(
  $$insert into public.athlete_wellness_checkins (user_id, checkin_date, legs)
    values ('e0000000-0000-4000-8000-00000000000e', '2026-10-13', 'tired')$$,
  '23514', null, 'unknown answers are rejected'
);
select throws_ok(
  $$insert into public.athlete_wellness_checkins (user_id, checkin_date, legs)
    values ('f0000000-0000-4000-8000-00000000000f', '2026-10-12', 'fresh')$$,
  '42501', null, 'athlete cannot write another athlete''s check-in'
);

select throws_ok(
  $$update public.athlete_wellness_checkins
    set user_id = 'f0000000-0000-4000-8000-00000000000f'$$,
  '42501', null, 'athlete cannot hand a check-in to another athlete'
);

select pg_temp.act_as('f0000000-0000-4000-8000-00000000000f');
select is(
  (select count(*)::int from public.athlete_wellness_checkins), 0,
  'another athlete sees no check-ins'
);
select throws_ok(
  $$update public.athlete_wellness_checkins set revision = 10$$,
  '42501', null, 'revision is not writable'
);

select * from finish();
rollback;
