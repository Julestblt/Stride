begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

grant usage on schema extensions to stride_coach_worker;

insert into auth.users (id, aud, role, email) values
  ('a4000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'outcome-a@example.com'),
  ('b4000000-0000-4000-8000-0000000000b4', 'authenticated', 'authenticated', 'outcome-b@example.com');

insert into public.training_plans (id, user_id, title, starts_on, ends_on, active_version, time_zone)
values
  ('40000000-0000-4000-8000-0000000000a4', 'a4000000-0000-4000-8000-0000000000a4', 'Plan A',
    current_date, current_date + 70, 2, 'Europe/Paris');

insert into public.coach_sessions (id, user_id, managed_session_id, mode, budget_cents)
values
  ('4c000000-0000-4000-8000-0000000000a4', 'a4000000-0000-4000-8000-0000000000a4',
    'sesn_outcomeA', 'conversation', 100),
  ('4c000000-0000-4000-8000-0000000000b4', 'b4000000-0000-4000-8000-0000000000b4',
    'sesn_outcomeB', 'conversation', 100);

insert into public.plan_proposals (
  id, user_id, plan_id, base_version, scope, origin, requested_by, status, title, operations,
  target_keys
)
values
  ('41000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-0000000000a4',
    '40000000-0000-4000-8000-0000000000a4', 2, 'session', 'recovery', 'athlete', 'accepted',
    'Séance allégée', '[]', array['s-1']),
  ('41000000-0000-4000-8000-000000000002', 'a4000000-0000-4000-8000-0000000000a4',
    '40000000-0000-4000-8000-0000000000a4', 2, 'session', 'recovery', 'athlete', 'accepted',
    'Séance déplacée', '[]', array['s-2']),
  ('41000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-0000000000a4',
    '40000000-0000-4000-8000-0000000000a4', 2, 'session', 'training', 'athlete', 'ready',
    'Séance remplacée', '[]', array['s-3']),
  ('41000000-0000-4000-8000-000000000004', 'a4000000-0000-4000-8000-0000000000a4',
    '40000000-0000-4000-8000-0000000000a4', 2, 'session', 'training', 'athlete', 'ready',
    'Séance supprimée', '[]', array['s-4']);

create function pg_temp.act_as(p_user uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

select ok(
  has_function_privilege('stride_coach_worker',
    'private.mark_plan_proposal_outcome(uuid, uuid, text, text)', 'execute')
    and not has_function_privilege('authenticated',
      'private.mark_plan_proposal_outcome(uuid, uuid, text, text)', 'execute')
    and not has_function_privilege('anon',
      'private.mark_plan_proposal_outcome(uuid, uuid, text, text)', 'execute')
    and not has_function_privilege('service_role',
      'private.mark_plan_proposal_outcome(uuid, uuid, text, text)', 'execute'),
  'only the coach worker may record a proposal outcome'
);

set local role stride_coach_worker;
select is(
  (private.mark_plan_proposal_outcome(
    'a4000000-0000-4000-8000-0000000000a4', '41000000-0000-4000-8000-000000000001',
    'stale', 'stale_version'
  )).status,
  'stale', 'the worker marks an accepted proposal stale'
);
select is(
  (private.mark_plan_proposal_outcome(
    'a4000000-0000-4000-8000-0000000000a4', '41000000-0000-4000-8000-000000000002',
    'invalid', '  '
  )).status,
  'invalid', 'the worker marks an accepted proposal invalid'
);
select throws_ok(
  $$select private.mark_plan_proposal_outcome(
    'a4000000-0000-4000-8000-0000000000a4', '41000000-0000-4000-8000-000000000001', 'stale', null)$$,
  'PT409', 'invalid_state', 'a proposal that is no longer accepted keeps its outcome'
);
select throws_ok(
  $$select private.mark_plan_proposal_outcome(
    'a4000000-0000-4000-8000-0000000000a4', '41000000-0000-4000-8000-000000000003', 'stale', null)$$,
  'PT409', 'invalid_state', 'a ready proposal cannot be marked stale'
);
select throws_ok(
  $$select private.mark_plan_proposal_outcome(
    'b4000000-0000-4000-8000-0000000000b4', '41000000-0000-4000-8000-000000000003', 'stale', null)$$,
  'PT404', 'not_found', 'the outcome is refused under another athlete'
);
select throws_ok(
  $$select private.mark_plan_proposal_outcome(
    'a4000000-0000-4000-8000-0000000000a4', '41000000-0000-4000-8000-000000000003', 'applied', null)$$,
  'PT400', 'invalid_outcome', 'only stale and invalid outcomes are recorded'
);
reset role;

select is(
  (select string_agg(decision || ':' || actor || ':' || coalesce(note, '-'), ',' order by decision)
    from public.plan_decisions
    where proposal_id in ('41000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000002')),
  'invalid:system:-,stale:system:stale_version',
  'each outcome writes a system decision'
);

select pg_temp.act_as('b4000000-0000-4000-8000-0000000000b4');
select throws_ok(
  $$select public.accept_plan_proposal('41000000-0000-4000-8000-000000000003')$$,
  'PT404', 'not_found', 'an athlete cannot accept another athlete proposal'
);
select throws_ok(
  $$select public.reject_plan_proposal('41000000-0000-4000-8000-000000000004')$$,
  'PT404', 'not_found', 'an athlete cannot reject another athlete proposal'
);
select is(
  (select count(*)::integer from public.plan_proposals),
  0, 'another athlete sees none of the proposals'
);
select is(
  (select count(*)::integer from public.plan_decisions),
  0, 'another athlete sees none of the decisions'
);
reset role;

select pg_temp.act_as('a4000000-0000-4000-8000-0000000000a4');
select is(
  (public.accept_plan_proposal('41000000-0000-4000-8000-000000000003')).status,
  'accepted', 'the owner accepts a ready proposal'
);
select is(
  (public.reject_plan_proposal('41000000-0000-4000-8000-000000000004', 'Week-end en famille')).status,
  'rejected', 'the owner rejects a ready proposal'
);
select throws_ok(
  $$select public.reject_plan_proposal('41000000-0000-4000-8000-000000000003')$$,
  'PT409', 'invalid_state', 'a decided proposal cannot be decided again'
);
select is(
  (select string_agg(decision || ':' || actor, ',' order by decision) from public.plan_decisions
    where proposal_id in ('41000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000004')),
  'accepted:athlete,rejected:athlete',
  'the owner reads their decisions'
);
select is(
  (public.submit_plan_proposal(
    'session', 'recovery', 'Séance allégée', 'Résumé', 'Raison',
    '[{"op": "skip_session", "sessionKey": "s-5"}]', '{"plan": null}',
    '40000000-0000-4000-8000-0000000000a4', 2, '[]', array['s-5'],
    '4c000000-0000-4000-8000-0000000000a4'
  )).coach_session_id,
  '4c000000-0000-4000-8000-0000000000a4'::uuid,
  'a proposal records its own coach session'
);
select throws_ok(
  $$select public.submit_plan_proposal(
    'session', 'recovery', 'Séance allégée', 'Résumé', 'Raison',
    '[{"op": "skip_session", "sessionKey": "s-6"}]', '{"plan": null}',
    '40000000-0000-4000-8000-0000000000a4', 2, '[]', array['s-6'],
    '4c000000-0000-4000-8000-0000000000b4')$$,
  'PT400', 'invalid_coach_session', 'a proposal cannot link another athlete coach session'
);
select is(
  (public.submit_plan_proposal(
    'session', 'recovery', 'Séance allégée', 'Résumé', 'Raison',
    '[{"op": "skip_session", "sessionKey": "s-7"}]', '{"plan": null}',
    '40000000-0000-4000-8000-0000000000a4', 2, '[]', array['s-7']
  )).coach_session_id,
  null::uuid, 'a proposal without a coach session stays unlinked'
);
reset role;

select ok(
  has_function_privilege('authenticated',
    'public.submit_plan_proposal(text, text, text, text, text, jsonb, jsonb, uuid, integer, jsonb, text[], uuid)',
    'execute')
    and not has_function_privilege('anon',
      'public.submit_plan_proposal(text, text, text, text, text, jsonb, jsonb, uuid, integer, jsonb, text[], uuid)',
      'execute'),
  'athletes submit proposals with an optional coach session'
);

select * from finish();
rollback;
