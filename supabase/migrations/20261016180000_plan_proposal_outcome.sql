alter table public.plan_proposals
  add column coach_session_id uuid references public.coach_sessions (id) on delete set null;

create index plan_proposals_coach_session_id_idx on public.plan_proposals (coach_session_id);

alter table public.plan_decisions drop constraint plan_decisions_decision_check;
alter table public.plan_decisions add constraint plan_decisions_decision_check check (
  decision in (
    'accepted', 'rejected', 'expired', 'superseded', 'stale', 'invalid', 'applied', 'reverted'
  )
);

drop function public.submit_plan_proposal(
  text, text, text, text, text, jsonb, jsonb, uuid, integer, jsonb, text[]
);

create function public.submit_plan_proposal(
  p_scope text,
  p_origin text,
  p_title text,
  p_summary text,
  p_rationale text,
  p_operations jsonb,
  p_preview jsonb,
  p_plan_id uuid default null,
  p_base_version integer default null,
  p_specialist_opinions jsonb default '[]',
  p_target_keys text[] default '{}',
  p_coach_session_id uuid default null
)
returns public.plan_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.training_plans;
  v_keys text[] := coalesce(
    (select array_agg(distinct key order by key) from unnest(p_target_keys) as keys (key)),
    '{}'
  );
  v_proposal public.plan_proposals;
  v_superseded uuid[];
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'PT401';
  end if;
  if p_scope is null or p_scope not in ('session', 'week', 'block', 'plan', 'new_plan') then
    raise exception 'invalid_scope' using errcode = 'PT400';
  end if;
  if jsonb_typeof(p_operations) is distinct from 'array'
    or jsonb_array_length(p_operations) not between 1 and 100
    or jsonb_typeof(p_preview) is distinct from 'object'
    or jsonb_typeof(p_specialist_opinions) is distinct from 'array'
    or cardinality(v_keys) > 200 then
    raise exception 'invalid_proposal' using errcode = 'PT400';
  end if;
  if p_coach_session_id is not null and not exists (
    select 1 from public.coach_sessions
    where id = p_coach_session_id and user_id = v_user_id
  ) then
    raise exception 'invalid_coach_session' using errcode = 'PT400';
  end if;

  if p_scope = 'new_plan' then
    if p_plan_id is not null or p_base_version is not null then
      raise exception 'invalid_proposal' using errcode = 'PT400';
    end if;
  else
    select * into v_plan from public.training_plans
      where id = p_plan_id and user_id = v_user_id;
    if not found or v_plan.status <> 'active' then
      raise exception 'not_found' using errcode = 'PT404';
    end if;
    if p_base_version is distinct from v_plan.active_version then
      raise exception 'stale_version' using errcode = 'PT409';
    end if;
  end if;

  with superseded as (
    update public.plan_proposals set status = 'superseded', updated_at = now()
      where user_id = v_user_id
        and plan_id is not distinct from p_plan_id
        and target_keys = v_keys
        and status = 'ready'
      returning id
  )
  select array_agg(id) into v_superseded from superseded;

  insert into public.plan_proposals (
    user_id, plan_id, base_version, scope, origin, requested_by, status, title, summary,
    rationale, operations, preview, specialist_opinions, target_keys, coach_session_id
  ) values (
    v_user_id, p_plan_id, p_base_version, p_scope, p_origin, 'athlete', 'ready', p_title,
    p_summary, p_rationale, p_operations, p_preview, p_specialist_opinions, v_keys,
    p_coach_session_id
  )
  returning * into v_proposal;

  update public.plan_proposals set superseded_by = v_proposal.id
    where id = any (v_superseded);

  return v_proposal;
end;
$$;

revoke all on function public.submit_plan_proposal(
  text, text, text, text, text, jsonb, jsonb, uuid, integer, jsonb, text[], uuid
) from public, anon, authenticated, service_role;
grant execute on function public.submit_plan_proposal(
  text, text, text, text, text, jsonb, jsonb, uuid, integer, jsonb, text[], uuid
) to authenticated;

create function private.mark_plan_proposal_outcome(
  p_user_id uuid,
  p_proposal_id uuid,
  p_outcome text,
  p_note text default null
)
returns public.plan_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.plan_proposals;
  v_note text := left(nullif(btrim(p_note), ''), 500);
begin
  if p_outcome is null or p_outcome not in ('stale', 'invalid') then
    raise exception 'invalid_outcome' using errcode = 'PT400';
  end if;

  select * into v_proposal from public.plan_proposals
    where id = p_proposal_id and user_id = p_user_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  if v_proposal.status <> 'accepted' then
    raise exception 'invalid_state' using errcode = 'PT409';
  end if;

  update public.plan_proposals set status = p_outcome, updated_at = now()
    where id = v_proposal.id
    returning * into v_proposal;
  insert into public.plan_decisions (user_id, proposal_id, decision, actor, note)
    values (p_user_id, v_proposal.id, p_outcome, 'system', v_note);

  return v_proposal;
end;
$$;

revoke all on function private.mark_plan_proposal_outcome(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function private.mark_plan_proposal_outcome(uuid, uuid, text, text)
  to stride_coach_worker;
