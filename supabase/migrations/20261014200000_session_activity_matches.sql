create table public.session_activity_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  session_key text not null check (session_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  session_revision_id uuid not null references public.plan_sessions (id) on delete cascade,
  activity_id uuid,
  method text not null check (method in ('auto', 'athlete')),
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  status text not null check (status in ('completed', 'partial', 'substituted', 'dismissed')),
  compliance jsonb not null default '{}' check (jsonb_typeof(compliance) = 'object'),
  algorithm_version text check (char_length(algorithm_version) between 1 and 32),
  computed_at timestamptz not null default now(),
  check ((activity_id is null) = (status = 'dismissed')),
  check (status <> 'dismissed' or method = 'athlete'),
  check (method <> 'auto' or algorithm_version is not null),
  unique (plan_id, activity_id)
);

create unique index session_activity_matches_one_dismissal
  on public.session_activity_matches (plan_id, session_key) where activity_id is null;
create index session_activity_matches_plan_id_session_key_idx
  on public.session_activity_matches (plan_id, session_key);
create index session_activity_matches_user_id_idx on public.session_activity_matches (user_id);
create index session_activity_matches_session_revision_id_idx
  on public.session_activity_matches (session_revision_id);

alter table public.session_activity_matches enable row level security;

create policy session_activity_matches_owner_select on public.session_activity_matches
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.session_activity_matches from anon, authenticated;
revoke insert, update, delete, truncate on public.session_activity_matches from service_role;
grant select on public.session_activity_matches to authenticated;

create function private.record_session_matches(
  p_plan_id uuid,
  p_matches jsonb,
  p_algorithm_version text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.training_plans;
  v_count integer;
begin
  if p_matches is null or jsonb_typeof(p_matches) <> 'array'
    or p_algorithm_version is null or char_length(p_algorithm_version) not between 1 and 32 then
    raise exception 'invalid_matches' using errcode = 'PT400';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_matches) as item (value)
    where jsonb_typeof(item.value) <> 'object'
      or item.value ->> 'sessionKey' is null
      or item.value ->> 'activityId' is null
      or coalesce(item.value ->> 'status', '') not in ('completed', 'partial', 'substituted')
      or jsonb_typeof(item.value -> 'confidence') is distinct from 'number'
      or (item.value ->> 'confidence')::numeric not between 0 and 1
      or jsonb_typeof(item.value -> 'compliance') is distinct from 'object'
  ) or (
    select count(*) <> count(distinct item.value ->> 'activityId')
    from jsonb_array_elements(p_matches) as item (value)
  ) then
    raise exception 'invalid_matches' using errcode = 'PT400';
  end if;

  select * into v_plan from public.training_plans where id = p_plan_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_matches) as item (value)
    where not exists (
      select 1 from public.plan_sessions s
      where s.plan_id = v_plan.id and s.valid_to_version is null
        and s.session_key = item.value ->> 'sessionKey' and s.sport <> 'rest' and s.kind <> 'rest'
    )
  ) then
    raise exception 'unknown_key' using errcode = 'PT422';
  end if;

  delete from public.session_activity_matches
    where plan_id = v_plan.id and method = 'auto';

  insert into public.session_activity_matches (
    user_id, plan_id, session_key, session_revision_id, activity_id, method, confidence,
    status, compliance, algorithm_version
  )
  select v_plan.user_id, v_plan.id, s.session_key, s.id, (item.value ->> 'activityId')::uuid,
    'auto', (item.value ->> 'confidence')::numeric, item.value ->> 'status',
    item.value -> 'compliance', p_algorithm_version
  from jsonb_array_elements(p_matches) as item (value)
  join public.plan_sessions s
    on s.plan_id = v_plan.id and s.valid_to_version is null
    and s.session_key = item.value ->> 'sessionKey'
  where not exists (
    select 1 from public.session_activity_matches m
    where m.plan_id = v_plan.id and m.method = 'athlete'
      and (m.session_key = s.session_key or m.activity_id = (item.value ->> 'activityId')::uuid)
  );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function private.owned_current_session(p_plan_id uuid, p_session_key text)
returns public.plan_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.plan_sessions;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'PT401';
  end if;
  perform 1 from public.training_plans
    where id = p_plan_id and user_id = v_user_id and status = 'active' for update;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  select * into v_session from public.plan_sessions
    where plan_id = p_plan_id and session_key = p_session_key
      and valid_to_version is null and sport <> 'rest' and kind <> 'rest';
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  return v_session;
end;
$$;

create function public.set_session_match(
  p_plan_id uuid,
  p_session_key text,
  p_activity_ids uuid[],
  p_status text default 'completed'
)
returns setof public.session_activity_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.plan_sessions := private.owned_current_session(p_plan_id, p_session_key);
  v_ids uuid[] := coalesce(p_activity_ids, '{}');
begin
  if cardinality(v_ids) > 0 and coalesce(p_status, '') not in ('completed', 'partial', 'substituted') then
    raise exception 'invalid_status' using errcode = 'PT400';
  end if;
  if cardinality(v_ids) > 20 or (
    select count(*) <> count(distinct id) or count(*) filter (where id is null) > 0
    from unnest(v_ids) as ids (id)
  ) then
    raise exception 'invalid_activities' using errcode = 'PT400';
  end if;

  delete from public.session_activity_matches
    where plan_id = p_plan_id and (session_key = p_session_key or activity_id = any (v_ids));

  if cardinality(v_ids) = 0 then
    return query
    insert into public.session_activity_matches (
      user_id, plan_id, session_key, session_revision_id, activity_id, method, confidence, status
    ) values (
      v_session.user_id, p_plan_id, p_session_key, v_session.id, null, 'athlete', 1, 'dismissed'
    ) returning *;
    return;
  end if;

  return query
  insert into public.session_activity_matches (
    user_id, plan_id, session_key, session_revision_id, activity_id, method, confidence,
    status, compliance
  )
  select v_session.user_id, p_plan_id, p_session_key, v_session.id, ids.id, 'athlete', 1,
    p_status, '{"duration": null, "distance": null, "intensity": null}'::jsonb
  from unnest(v_ids) as ids (id)
  returning *;
end;
$$;

create function public.clear_session_match(p_plan_id uuid, p_session_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.plan_sessions := private.owned_current_session(p_plan_id, p_session_key);
  v_count integer;
begin
  delete from public.session_activity_matches
    where plan_id = p_plan_id and session_key = v_session.session_key and method = 'athlete';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function private.apply_plan_proposal(p_proposal_id uuid, p_changeset jsonb)
returns public.plan_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal public.plan_proposals;
  v_plan public.training_plans;
  v_header jsonb := p_changeset -> 'plan';
  v_previous public.plan_versions;
  v_version public.plan_versions;
  v_new_version integer;
  v_today date;
  v_closed text[];
  v_count integer;
  v_entity text;
begin
  if p_changeset is null or jsonb_typeof(p_changeset) <> 'object' or not (p_changeset ? 'plan')
    or jsonb_typeof(v_header) not in ('object', 'null') then
    raise exception 'invalid_changeset' using errcode = 'PT400';
  end if;
  foreach v_entity in array array['blocks', 'weeks', 'sessions'] loop
    if jsonb_typeof(p_changeset -> v_entity -> 'closed') is distinct from 'array'
      or jsonb_typeof(p_changeset -> v_entity -> 'added') is distinct from 'array' then
      raise exception 'invalid_changeset' using errcode = 'PT400', detail = v_entity;
    end if;
  end loop;

  select * into v_proposal from public.plan_proposals
    where id = p_proposal_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  if v_proposal.status <> 'accepted' then
    raise exception 'invalid_state' using errcode = 'PT409';
  end if;

  if v_proposal.scope = 'new_plan' then
    if jsonb_typeof(v_header) <> 'object'
      or jsonb_array_length(p_changeset -> 'blocks' -> 'closed') > 0
      or jsonb_array_length(p_changeset -> 'weeks' -> 'closed') > 0
      or jsonb_array_length(p_changeset -> 'sessions' -> 'closed') > 0 then
      raise exception 'invalid_changeset' using errcode = 'PT400', detail = 'new_plan';
    end if;
    perform 1 from public.training_plans
      where user_id = v_proposal.user_id and status = 'active' for update;
    v_today := (now() at time zone (v_header ->> 'timeZone'))::date;
  else
    select * into v_plan from public.training_plans
      where id = v_proposal.plan_id and user_id = v_proposal.user_id for update;
    if not found or v_plan.status <> 'active' then
      raise exception 'invalid_state' using errcode = 'PT409';
    end if;
    if v_proposal.base_version <> v_plan.active_version then
      raise exception 'stale_version' using errcode = 'PT409';
    end if;
    v_today := (now() at time zone v_plan.time_zone)::date;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_changeset -> 'sessions' -> 'added') as added (item)
    where (added.item ->> 'scheduledOn')::date < v_today
  ) then
    raise exception 'frozen_session' using errcode = 'PT422';
  end if;

  if jsonb_typeof(v_header) = 'object' and v_header ->> 'primaryRaceId' is not null
    and not exists (
      select 1 from public.athlete_races
      where id = (v_header ->> 'primaryRaceId')::uuid and user_id = v_proposal.user_id
    ) then
    raise exception 'unknown_race' using errcode = 'PT422';
  end if;

  if v_proposal.scope = 'new_plan' then
    update public.training_plans set status = 'archived', updated_at = now()
      where user_id = v_proposal.user_id and status = 'active';
    insert into public.training_plans (
      user_id, title, starts_on, ends_on, primary_race_id, active_version, time_zone
    ) values (
      v_proposal.user_id,
      v_header ->> 'title',
      (v_header ->> 'startsOn')::date,
      (v_header ->> 'endsOn')::date,
      (v_header ->> 'primaryRaceId')::uuid,
      1,
      v_header ->> 'timeZone'
    ) returning * into v_plan;
    v_new_version := 1;
  else
    v_new_version := v_plan.active_version + 1;
    select * into v_previous from public.plan_versions
      where plan_id = v_plan.id and version = v_plan.active_version;

    select coalesce(array_agg(value), '{}') into v_closed
      from jsonb_array_elements_text(p_changeset -> 'sessions' -> 'closed');
    if exists (
      select 1 from public.plan_sessions
      where plan_id = v_plan.id and valid_to_version is null
        and session_key = any (v_closed) and scheduled_on < v_today
    ) or exists (
      select 1 from public.session_activity_matches
      where plan_id = v_plan.id and session_key = any (v_closed)
    ) then
      raise exception 'frozen_session' using errcode = 'PT422';
    end if;

    update public.plan_sessions set valid_to_version = v_new_version
      where plan_id = v_plan.id and valid_to_version is null and session_key = any (v_closed);
    get diagnostics v_count = row_count;
    if v_count <> cardinality(v_closed) then
      raise exception 'unknown_key' using errcode = 'PT422', detail = 'sessions';
    end if;

    select coalesce(array_agg(value), '{}') into v_closed
      from jsonb_array_elements_text(p_changeset -> 'weeks' -> 'closed');
    update public.plan_weeks set valid_to_version = v_new_version
      where plan_id = v_plan.id and valid_to_version is null and week_key = any (v_closed);
    get diagnostics v_count = row_count;
    if v_count <> cardinality(v_closed) then
      raise exception 'unknown_key' using errcode = 'PT422', detail = 'weeks';
    end if;

    select coalesce(array_agg(value), '{}') into v_closed
      from jsonb_array_elements_text(p_changeset -> 'blocks' -> 'closed');
    update public.plan_blocks set valid_to_version = v_new_version
      where plan_id = v_plan.id and valid_to_version is null and block_key = any (v_closed);
    get diagnostics v_count = row_count;
    if v_count <> cardinality(v_closed) then
      raise exception 'unknown_key' using errcode = 'PT422', detail = 'blocks';
    end if;

    update public.training_plans set
      title = coalesce(v_header ->> 'title', title),
      starts_on = coalesce((v_header ->> 'startsOn')::date, starts_on),
      ends_on = coalesce((v_header ->> 'endsOn')::date, ends_on),
      primary_race_id = case
        when jsonb_typeof(v_header) = 'object' then (v_header ->> 'primaryRaceId')::uuid
        else primary_race_id
      end,
      time_zone = coalesce(v_header ->> 'timeZone', time_zone),
      active_version = v_new_version,
      updated_at = now()
    where id = v_plan.id
    returning * into v_plan;
  end if;

  insert into public.plan_blocks (
    plan_id, user_id, block_key, valid_from_version, kind, name, starts_on, ends_on,
    objective, race_id
  )
  select v_plan.id, v_proposal.user_id, item ->> 'blockKey', v_new_version, item ->> 'kind',
    item ->> 'name', (item ->> 'startsOn')::date, (item ->> 'endsOn')::date,
    item ->> 'objective', (item ->> 'raceId')::uuid
  from jsonb_array_elements(p_changeset -> 'blocks' -> 'added') as added (item);

  insert into public.plan_weeks (
    plan_id, user_id, week_key, valid_from_version, week_start, block_key, week_type,
    target_duration_s, target_distance_m, target_elevation_m, quality_sessions,
    long_run_target_s, intensity_split, notes
  )
  select v_plan.id, v_proposal.user_id, item ->> 'weekKey', v_new_version,
    (item ->> 'weekStart')::date, item ->> 'blockKey', item ->> 'weekType',
    (item -> 'targets' ->> 'durationSeconds')::integer,
    (item -> 'targets' ->> 'distanceMeters')::integer,
    (item -> 'targets' ->> 'elevationGainMeters')::integer,
    (item -> 'targets' ->> 'qualitySessions')::smallint,
    (item -> 'targets' ->> 'longRunSeconds')::integer,
    item -> 'targets' -> 'intensitySplit',
    item ->> 'notes'
  from jsonb_array_elements(p_changeset -> 'weeks' -> 'added') as added (item);

  insert into public.plan_sessions (
    plan_id, user_id, session_key, valid_from_version, scheduled_on, sport, kind, title,
    purpose, is_key, priority, targets, structure, terrain, origin, contingencies
  )
  select v_plan.id, v_proposal.user_id, item ->> 'sessionKey', v_new_version,
    (item ->> 'scheduledOn')::date, item ->> 'sport', item ->> 'kind', item ->> 'title',
    item ->> 'purpose', (item ->> 'isKey')::boolean, item ->> 'priority', item -> 'targets',
    item -> 'structure', item ->> 'terrain', item ->> 'origin',
    coalesce(item -> 'contingencies', '[]')
  from jsonb_array_elements(p_changeset -> 'sessions' -> 'added') as added (item);

  insert into public.plan_versions (
    plan_id, version, user_id, parent_version, source_proposal_id, created_by,
    effective_from, race_roles, confidence, summary, content_hash
  ) values (
    v_plan.id,
    v_new_version,
    v_proposal.user_id,
    nullif(v_new_version - 1, 0),
    v_proposal.id,
    case v_proposal.requested_by when 'athlete' then 'athlete' else 'coach' end,
    v_today,
    case when jsonb_typeof(v_header) = 'object'
      then coalesce(v_header -> 'raceRoles', '[]') else v_previous.race_roles end,
    case when jsonb_typeof(v_header) = 'object'
      then v_header -> 'confidence' else v_previous.confidence end,
    coalesce(v_proposal.summary, v_proposal.title),
    encode(pg_catalog.sha256(convert_to(p_changeset::text, 'UTF8')), 'hex')
  ) returning * into v_version;

  insert into public.plan_decisions (user_id, proposal_id, decision, actor, resulting_version)
    values (v_proposal.user_id, v_proposal.id, 'applied', 'system', v_new_version);

  update public.plan_proposals set
    status = 'applied',
    plan_id = v_plan.id,
    applied_version = v_new_version,
    updated_at = now()
  where id = v_proposal.id;

  return v_version;
end;
$$;

revoke all on function private.record_session_matches(uuid, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function private.owned_current_session(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.set_session_match(uuid, text, uuid[], text)
  from public, anon, authenticated, service_role;
revoke all on function public.clear_session_match(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.record_session_matches(uuid, jsonb, text) to stride_coach_worker;
grant execute on function public.set_session_match(uuid, text, uuid[], text) to authenticated;
grant execute on function public.clear_session_match(uuid, text) to authenticated;
