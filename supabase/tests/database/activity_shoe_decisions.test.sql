begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, aud, role, email) values
  ('a4000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'decisions-a@example.com'),
  ('b4000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'decisions-b@example.com');

insert into public.athlete_shoes
  (id, user_id, brand, model, category, terrain, lifespan_km, first_use_date)
values
  ('a4000000-0000-4000-8000-0000000000a1', 'a4000000-0000-4000-8000-00000000000a',
   'Adidas', 'Adizero Evo SL', 'daily', 'road', 800, '2026-06-02'),
  ('b4000000-0000-4000-8000-0000000000b1', 'b4000000-0000-4000-8000-00000000000b',
   'Nike', 'Zegama', 'daily', 'trail', 700, '2026-05-01');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select ok(rowsecurity, 'pair decisions have RLS enabled')
from pg_tables where schemaname = 'public' and tablename = 'activity_shoe_decisions';

set local role anon;
select throws_ok('select * from public.activity_shoe_decisions', '42501', null,
  'anonymous user cannot read pair decisions');
reset role;

select pg_temp.act_as('a4000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$insert into public.activity_shoe_decisions (user_id, provider_activity_id, decision, shoe_id)
    values ('a4000000-0000-4000-8000-00000000000a', '21894512345', 'assigned',
      'a4000000-0000-4000-8000-0000000000a1')$$,
  'Stride records the pair it assigned'
);
select lives_ok(
  $$insert into public.activity_shoe_decisions (user_id, provider_activity_id, decision, shoe_id)
    values ('a4000000-0000-4000-8000-00000000000a', '21894512345', 'corrected',
      'a4000000-0000-4000-8000-0000000000a1')
    on conflict (user_id, provider_activity_id)
    do update set user_id = excluded.user_id,
      provider_activity_id = excluded.provider_activity_id,
      decision = excluded.decision, shoe_id = excluded.shoe_id, updated_at = now()$$,
  'the athlete corrects the pair of the same activity'
);
select throws_ok(
  $$insert into public.activity_shoe_decisions (user_id, provider_activity_id, decision, shoe_id)
    values ('a4000000-0000-4000-8000-00000000000a', '21894512346', 'corrected',
      'b4000000-0000-4000-8000-0000000000b1')$$,
  '23503', null, 'athlete cannot record another athlete''s pair'
);
select throws_ok(
  $$insert into public.activity_shoe_decisions (user_id, provider_activity_id, decision)
    values ('b4000000-0000-4000-8000-00000000000b', '21894512346', 'confirmed')$$,
  '42501', null, 'athlete cannot record a decision for someone else'
);
select throws_ok(
  $$insert into public.activity_shoe_decisions (user_id, provider_activity_id, decision)
    values ('a4000000-0000-4000-8000-00000000000a', '21894512347', 'ignored')$$,
  '23514', null, 'only known decisions are stored'
);
reset role;

select pg_temp.act_as('b4000000-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.activity_shoe_decisions), 0,
  'another athlete sees no decision');
reset role;

delete from public.athlete_shoes where id = 'a4000000-0000-4000-8000-0000000000a1';
select is(
  (select decision || ':' || coalesce(shoe_id::text, 'none') from public.activity_shoe_decisions),
  'corrected:none', 'deleting a pair keeps the decision without its pair');

select * from finish();
rollback;
