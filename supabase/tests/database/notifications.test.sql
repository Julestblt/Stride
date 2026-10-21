begin;

create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, aud, role, email) values
  ('a7000000-0000-4000-8000-0000000000a7', 'authenticated', 'authenticated', 'notif-a@example.com'),
  ('b7000000-0000-4000-8000-0000000000b7', 'authenticated', 'authenticated', 'notif-b@example.com');

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.notification(p_key text) returns public.notifications language sql as $$
  select * from public.notifications
  where user_id = 'a7000000-0000-4000-8000-0000000000a7' and dedupe_key = p_key;
$$;

select ok(rowsecurity, 'notifications have RLS enabled')
from pg_tables
where schemaname = 'public' and tablename = 'notifications';

set local role anon;
select throws_ok(
  'select * from public.notifications', '42501', null,
  'anonymous user cannot read notifications'
);
reset role;

insert into public.plan_proposals (id, user_id, plan_id, base_version, scope, origin, requested_by,
  status, title, summary, operations)
values ('a7000000-0000-4000-8000-0000000000e1', 'a7000000-0000-4000-8000-0000000000a7', null, null,
  'new_plan', 'training', 'athlete', 'ready', 'Raccourcir ton seuil', '5 × 6’ → 4 × 6’', '[]');

select is(
  (select kind || '/' || (read_at is null) || '/' || (resolved_at is null) || '/' || (payload ->> 'title')
    from pg_temp.notification('plan_proposal:a7000000-0000-4000-8000-0000000000e1')),
  'plan_proposal/true/true/Raccourcir ton seuil',
  'a ready proposal creates an unread notification to review'
);

update public.plan_proposals set status = 'applied'
  where id = 'a7000000-0000-4000-8000-0000000000e1';
select is(
  (select resolution || '/' || (read_at is not null)
    from pg_temp.notification('plan_proposal:a7000000-0000-4000-8000-0000000000e1')),
  'applied/true', 'an applied proposal resolves and reads its notification'
);

insert into public.plan_proposals (id, user_id, plan_id, base_version, scope, origin, requested_by,
  status, title, operations)
values ('a7000000-0000-4000-8000-0000000000e2', 'a7000000-0000-4000-8000-0000000000a7', null, null,
  'new_plan', 'training', 'athlete', 'ready', 'Semaine allégée', '[]');
update public.plan_proposals set status = 'rejected'
  where id = 'a7000000-0000-4000-8000-0000000000e2';
select is(
  (select resolution from pg_temp.notification('plan_proposal:a7000000-0000-4000-8000-0000000000e2')),
  'rejected', 'a rejected proposal resolves as rejected'
);

insert into public.plan_proposals (id, user_id, plan_id, base_version, scope, origin, requested_by,
  status, title, operations)
values ('a7000000-0000-4000-8000-0000000000e3', 'a7000000-0000-4000-8000-0000000000a7', null, null,
  'new_plan', 'training', 'athlete', 'draft', 'Brouillon', '[]');
select is(
  (select count(*)::int from public.notifications where dedupe_key = 'plan_proposal:a7000000-0000-4000-8000-0000000000e3'),
  0, 'a draft proposal creates no notification'
);
update public.plan_proposals set status = 'ready'
  where id = 'a7000000-0000-4000-8000-0000000000e3';
update public.plan_proposals set status = 'superseded'
  where id = 'a7000000-0000-4000-8000-0000000000e3';
select is(
  (select resolution || '/' || (read_at is null)
    from pg_temp.notification('plan_proposal:a7000000-0000-4000-8000-0000000000e3')),
  'replaced/true', 'a superseded proposal resolves as replaced and stays unread'
);

insert into public.plan_proposals (id, user_id, plan_id, base_version, scope, origin, requested_by,
  status, title, operations)
values ('a7000000-0000-4000-8000-0000000000e4', 'a7000000-0000-4000-8000-0000000000a7', null, null,
  'new_plan', 'training', 'athlete', 'ready', 'Plan périmé', '[]');
update public.plan_proposals set status = 'accepted'
  where id = 'a7000000-0000-4000-8000-0000000000e4';
update public.plan_proposals set status = 'stale'
  where id = 'a7000000-0000-4000-8000-0000000000e4';
select is(
  (select resolution from public.notifications
    where dedupe_key = 'plan_proposal:a7000000-0000-4000-8000-0000000000e4'),
  'replaced', 'an accepted proposal that ends stale is no longer shown as applied'
);

insert into public.coach_sessions (id, user_id, managed_session_id, mode, budget_cents, title)
values
  ('a7000000-0000-4000-8000-00000000c001', 'a7000000-0000-4000-8000-0000000000a7',
    'sesn_01NotifA', 'conversation', 100, 'Ravitaillements'),
  ('a7000000-0000-4000-8000-00000000c002', 'a7000000-0000-4000-8000-0000000000a7',
    'sesn_01NotifB', 'conversation', 100, 'Silence'),
  ('a7000000-0000-4000-8000-00000000c003', 'a7000000-0000-4000-8000-0000000000a7',
    'sesn_01NotifC', 'plan', 100, null);

insert into public.coach_thread_items (user_id, coach_session_id, kind, body) values
  ('a7000000-0000-4000-8000-0000000000a7', 'a7000000-0000-4000-8000-00000000c001', 'coach',
    '{"text": "7 ravitos   sur l’EcoTrail."}'),
  ('a7000000-0000-4000-8000-0000000000a7', 'a7000000-0000-4000-8000-00000000c003', 'coach',
    '{"text": "Plan prêt."}');

update public.coach_sessions set status = 'idle'
  where id in ('a7000000-0000-4000-8000-00000000c001', 'a7000000-0000-4000-8000-00000000c002',
    'a7000000-0000-4000-8000-00000000c003');
select is(
  (select (payload ->> 'excerpt') || '/' || (read_at is null)
    from pg_temp.notification('staff_reply:a7000000-0000-4000-8000-00000000c001')),
  '7 ravitos sur l’EcoTrail./true', 'a finished turn creates an unread staff reply with an excerpt'
);
select is(
  (select count(*)::int from public.notifications
    where payload ->> 'threadId' in ('a7000000-0000-4000-8000-00000000c002',
      'a7000000-0000-4000-8000-00000000c003')),
  0, 'a turn without a coach message or an untitled session creates no reply'
);

insert into public.coach_sessions (id, user_id, managed_session_id, mode, budget_cents, title,
  status, last_activity_at)
values ('a7000000-0000-4000-8000-00000000c004', 'a7000000-0000-4000-8000-0000000000a7',
  'sesn_01NotifD', 'conversation', 100, 'Ancien message', 'running', now());
insert into public.coach_thread_items (user_id, coach_session_id, kind, body, created_at) values
  ('a7000000-0000-4000-8000-0000000000a7', 'a7000000-0000-4000-8000-00000000c004', 'coach',
    '{"text": "Réponse d’un tour précédent."}', now() - interval '1 hour');
update public.coach_sessions set status = 'idle'
  where id = 'a7000000-0000-4000-8000-00000000c004';
select is(
  (select count(*)::int from public.notifications
    where dedupe_key = 'staff_reply:a7000000-0000-4000-8000-00000000c004'),
  0, 'a turn without a coach message since it started creates no reply'
);

update public.coach_sessions set read_at = now()
  where id = 'a7000000-0000-4000-8000-00000000c001';
select ok(
  (select read_at is not null from pg_temp.notification('staff_reply:a7000000-0000-4000-8000-00000000c001')),
  'opening the thread marks its reply read'
);

update public.coach_sessions set status = 'running'
  where id = 'a7000000-0000-4000-8000-00000000c001';
insert into public.coach_thread_items (user_id, coach_session_id, kind, body) values
  ('a7000000-0000-4000-8000-0000000000a7', 'a7000000-0000-4000-8000-00000000c001', 'coach',
    '{"text": "70 g de glucides par heure."}');
update public.coach_sessions set status = 'idle'
  where id = 'a7000000-0000-4000-8000-00000000c001';
select is(
  (select (payload ->> 'excerpt') || '/' || (read_at is null) || '/' ||
      (select count(*) from public.notifications where kind = 'staff_reply'
        and payload ->> 'threadId' = 'a7000000-0000-4000-8000-00000000c001')
    from pg_temp.notification('staff_reply:a7000000-0000-4000-8000-00000000c001')),
  '70 g de glucides par heure./true/1', 'a new reply refreshes the single thread notification to unread'
);

update public.coach_sessions set status = 'running'
  where id = 'a7000000-0000-4000-8000-00000000c001';
insert into public.coach_thread_items (user_id, coach_session_id, kind, body) values
  ('a7000000-0000-4000-8000-0000000000a7', 'a7000000-0000-4000-8000-00000000c001', 'question',
    '{"toolUseId": "toolu_legs", "question": "Et tes jambes ce matin ?", "askedFor": "medical"}');
update public.coach_sessions set status = 'awaiting_athlete', pending_tool_use_id = 'toolu_legs'
  where id = 'a7000000-0000-4000-8000-00000000c001';
select is(
  (select (payload ->> 'question') || '/' || (payload ->> 'agent') || '/' || (resolved_at is null)
    from pg_temp.notification('staff_question:a7000000-0000-4000-8000-00000000c001:toolu_legs')),
  'Et tes jambes ce matin ?/medical/true', 'a pending question creates a notification to answer'
);

update public.coach_sessions set status = 'running', pending_tool_use_id = null
  where id = 'a7000000-0000-4000-8000-00000000c001';
select is(
  (select resolution || '/' || (read_at is not null)
    from pg_temp.notification('staff_question:a7000000-0000-4000-8000-00000000c001:toolu_legs')),
  'answered/true', 'clearing the pending question resolves it as answered'
);

select pg_temp.act_as('a7000000-0000-4000-8000-0000000000a7');
select is(
  (select count(*)::int from public.notifications), 6,
  'the athlete reads their own notifications'
);
select lives_ok(
  $$update public.notifications set read_at = now() where read_at is null$$,
  'the athlete marks notifications read'
);
select is(
  (select count(*)::int from public.notifications where read_at is null), 0,
  'every notification is read'
);
select throws_ok(
  $$update public.notifications set resolution = 'applied'$$,
  '42501', null, 'resolution is not writable'
);
select throws_ok(
  $$update public.notifications set payload = '{}'$$,
  '42501', null, 'payload is not writable'
);
select throws_ok(
  $$insert into public.notifications (user_id, kind, dedupe_key)
    values ('a7000000-0000-4000-8000-0000000000a7', 'staff_reply', 'staff_reply:forged')$$,
  '42501', null, 'the athlete cannot insert notifications'
);
select throws_ok(
  $$delete from public.notifications$$,
  '42501', null, 'the athlete cannot delete notifications'
);

select pg_temp.act_as('b7000000-0000-4000-8000-0000000000b7');
select is(
  (select count(*)::int from public.notifications), 0,
  'another athlete sees no notifications'
);
with changed as (update public.notifications set read_at = null returning 1)
select is(
  (select count(*)::int from changed),
  0, 'another athlete cannot update notifications'
);
reset role;

delete from public.coach_sessions where id = 'a7000000-0000-4000-8000-00000000c001';
select is(
  (select count(*)::int from public.notifications
    where payload ->> 'threadId' = 'a7000000-0000-4000-8000-00000000c001'),
  0, 'deleting a thread removes its notifications'
);

delete from public.plan_proposals where id = 'a7000000-0000-4000-8000-0000000000e2';
select is(
  (select count(*)::int from public.notifications where dedupe_key = 'plan_proposal:a7000000-0000-4000-8000-0000000000e2'),
  0, 'deleting a proposal removes its notification'
);

select * from finish();
rollback;
