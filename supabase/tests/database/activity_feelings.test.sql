begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, aud, role, email) values
  ('a9000000-0000-4000-8000-0000000000a9', 'authenticated', 'authenticated', 'feel-a@example.com'),
  ('b9000000-0000-4000-8000-0000000000b9', 'authenticated', 'authenticated', 'feel-b@example.com');

insert into public.provider_connections (id, user_id, provider, status, updated_at) values
  ('c9000000-0000-4000-8000-0000000000a9', 'a9000000-0000-4000-8000-0000000000a9', 'garmin', 'connected', now()),
  ('c9000000-0000-4000-8000-0000000000b9', 'b9000000-0000-4000-8000-0000000000b9', 'garmin', 'connected', now());

insert into public.provider_activities (
  id, user_id, connection_id, provider, provider_activity_id, activity_type, started_at, imported_at
) values
  ('e9000000-0000-4000-8000-0000000000a1', 'a9000000-0000-4000-8000-0000000000a9',
   'c9000000-0000-4000-8000-0000000000a9', 'garmin', 'feel-a1', 'running', now() - interval '3 hours', now()),
  ('e9000000-0000-4000-8000-0000000000b1', 'b9000000-0000-4000-8000-0000000000b9',
   'c9000000-0000-4000-8000-0000000000b9', 'garmin', 'feel-b1', 'running', now() - interval '3 hours', now());

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select ok(rowsecurity, 'activity feelings have RLS enabled')
from pg_tables
where schemaname = 'public' and tablename = 'activity_feelings';

set local role anon;
select throws_ok(
  'select * from public.activity_feelings', '42501', null,
  'anonymous user cannot read feelings'
);
reset role;

select pg_temp.act_as('a9000000-0000-4000-8000-0000000000a9');
select lives_ok(
  $$insert into public.activity_feelings (user_id, activity_id, effort, feel)
    values ('a9000000-0000-4000-8000-0000000000a9', 'e9000000-0000-4000-8000-0000000000a1', 8, 25)
    on conflict (user_id, activity_id) do update
      set effort = excluded.effort, feel = excluded.feel$$,
  'athlete records a feeling for an own activity'
);
select lives_ok(
  $$insert into public.activity_feelings (user_id, activity_id, effort, feel)
    values ('a9000000-0000-4000-8000-0000000000a9', 'e9000000-0000-4000-8000-0000000000a1', 6, 75)
    on conflict (user_id, activity_id) do update
      set effort = excluded.effort, feel = excluded.feel$$,
  'a second answer updates the same activity'
);
select is(
  (select effort || '/' || feel || '/' || revision from public.activity_feelings),
  '6/75/2', 'the feeling is updated and the revision advances'
);
select throws_ok(
  $$insert into public.activity_feelings (user_id, activity_id, effort, feel)
    values ('a9000000-0000-4000-8000-0000000000a9', 'e9000000-0000-4000-8000-0000000000a1', 11, null)
    on conflict (user_id, activity_id) do update set effort = excluded.effort$$,
  '23514', null, 'effort outside 1 to 10 is rejected'
);
select throws_ok(
  $$update public.activity_feelings set feel = 40$$,
  '23514', null, 'feel outside the five answers is rejected'
);
select throws_ok(
  $$insert into public.activity_feelings (user_id, activity_id, effort)
    values ('a9000000-0000-4000-8000-0000000000a9', 'e9000000-0000-4000-8000-0000000000b1', 5)$$,
  '42501', null, 'athlete cannot record a feeling for another athlete''s activity'
);
select throws_ok(
  $$update public.activity_feelings
    set activity_id = 'e9000000-0000-4000-8000-0000000000b1'$$,
  '42501', null, 'athlete cannot move a feeling onto another athlete''s activity'
);

select pg_temp.act_as('b9000000-0000-4000-8000-0000000000b9');
select is(
  (select count(*)::int from public.activity_feelings), 0,
  'another athlete sees no feelings'
);
select throws_ok(
  $$update public.activity_feelings set revision = 10$$,
  '42501', null, 'revision is not writable'
);

select * from finish();
rollback;
