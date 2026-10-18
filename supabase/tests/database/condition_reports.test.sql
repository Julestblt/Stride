begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, aud, role, email) values
  ('e1000000-0000-4000-8000-00000000000e', 'authenticated', 'authenticated', 'cond-e@example.com'),
  ('f1000000-0000-4000-8000-00000000000f', 'authenticated', 'authenticated', 'cond-f@example.com');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select ok(rowsecurity, 'condition reports have RLS enabled')
from pg_tables
where schemaname = 'public' and tablename = 'athlete_condition_reports';

set local role anon;
select throws_ok(
  'select * from public.athlete_condition_reports', '42501', null,
  'anonymous user cannot read condition reports'
);
reset role;

select pg_temp.act_as('e1000000-0000-4000-8000-00000000000e');
select lives_ok(
  $$insert into public.athlete_condition_reports
      (user_id, kind, body_area, severity, started_on, note, source)
    values ('e1000000-0000-4000-8000-00000000000e', 'pain', 'shin', 5,
      '2026-10-16', 'Tibia droit après la descente', 'coach_confirmed')$$,
  'athlete records a shin pain'
);
select lives_ok(
  $$update public.athlete_condition_reports
    set status = 'resolved', resolved_on = '2026-10-18'$$,
  'athlete resolves the report'
);
select is(
  (select status || '/' || resolved_on || '/' || revision
    from public.athlete_condition_reports),
  'resolved/2026-10-18/2', 'resolution is kept and the revision advances'
);
select throws_ok(
  $$update public.athlete_condition_reports set status = 'active'$$,
  '23514', null, 'an open report cannot keep a resolution date'
);
select throws_ok(
  $$insert into public.athlete_condition_reports
      (user_id, kind, severity, started_on)
    values ('e1000000-0000-4000-8000-00000000000e', 'pain', 11, '2026-10-16')$$,
  '23514', null, 'severity above 10 is rejected'
);
select throws_ok(
  $$insert into public.athlete_condition_reports
      (user_id, kind, severity, started_on)
    values ('f1000000-0000-4000-8000-00000000000f', 'pain', 3, '2026-10-16')$$,
  '42501', null, 'athlete cannot write another athlete''s report'
);
select throws_ok(
  $$update public.athlete_condition_reports
    set user_id = 'f1000000-0000-4000-8000-00000000000f'$$,
  '42501', null, 'athlete cannot hand a report to another athlete'
);

select pg_temp.act_as('f1000000-0000-4000-8000-00000000000f');
select is(
  (select count(*)::int from public.athlete_condition_reports), 0,
  'another athlete sees no condition reports'
);
select throws_ok(
  $$update public.athlete_condition_reports set revision = 10$$,
  '42501', null, 'revision is not writable'
);

select * from finish();
rollback;
