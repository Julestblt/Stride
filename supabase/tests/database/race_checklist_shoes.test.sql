begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, aud, role, email) values
  ('a5000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'race-shoes-a@example.com'),
  ('b5000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'race-shoes-b@example.com');

insert into public.athlete_races (id, user_id, name, race_kind, priority) values
  ('a5000000-0000-4000-8000-0000000000c1', 'a5000000-0000-4000-8000-00000000000a',
   'EcoTrail Paris', 'trail', 'A');

insert into public.athlete_shoes
  (id, user_id, brand, model, category, terrain, lifespan_km, first_use_date)
values
  ('a5000000-0000-4000-8000-0000000000a1', 'a5000000-0000-4000-8000-00000000000a',
   'Nike', 'Zegama', 'daily', 'trail', 700, '2026-05-01'),
  ('b5000000-0000-4000-8000-0000000000b1', 'b5000000-0000-4000-8000-00000000000b',
   'Hoka', 'Speedgoat', 'daily', 'trail', 700, '2026-05-01');

insert into public.race_checklist_items (id, race_id, user_id, list, label) values
  ('a5000000-0000-4000-8000-0000000000d1', 'a5000000-0000-4000-8000-0000000000c1',
   'a5000000-0000-4000-8000-00000000000a', 'gear_kit', 'Chaussures');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select pg_temp.act_as('a5000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$update public.race_checklist_items set shoe_id = 'a5000000-0000-4000-8000-0000000000a1'
    where id = 'a5000000-0000-4000-8000-0000000000d1'$$,
  'athlete links the shoe line to a pair'
);
select throws_ok(
  $$update public.race_checklist_items set shoe_id = 'b5000000-0000-4000-8000-0000000000b1'
    where id = 'a5000000-0000-4000-8000-0000000000d1'$$,
  '23503', null, 'athlete cannot link another athlete''s pair'
);
reset role;

select pg_temp.act_as('b5000000-0000-4000-8000-00000000000b');
select is(
  (select count(*)::int from public.race_checklist_items), 0,
  'another athlete sees no checklist line');
reset role;

delete from public.athlete_shoes where id = 'a5000000-0000-4000-8000-0000000000a1';
select is(
  (select shoe_id from public.race_checklist_items), null::uuid,
  'deleting the pair unlinks the line');
select is(
  (select label from public.race_checklist_items), 'Chaussures',
  'the line itself is kept');

select * from finish();
rollback;
