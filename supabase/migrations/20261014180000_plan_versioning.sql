do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'stride_coach_worker') then
    create role stride_coach_worker nologin;
  end if;
end;
$$;

grant stride_coach_worker to postgres;
grant usage on schema private to stride_coach_worker;

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'archived')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  starts_on date not null,
  ends_on date not null,
  primary_race_id uuid references public.athlete_races (id) on delete set null,
  active_version integer not null check (active_version > 0),
  time_zone text not null
    check (char_length(time_zone) between 1 and 64 and time_zone ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create unique index training_plans_one_active_per_user
  on public.training_plans (user_id) where status = 'active';
create index training_plans_user_id_idx on public.training_plans (user_id);
create index training_plans_primary_race_id_idx on public.training_plans (primary_race_id);

create table public.plan_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references public.training_plans (id) on delete cascade,
  base_version integer check (base_version > 0),
  scope text not null check (scope in ('session', 'week', 'block', 'plan', 'new_plan', 'undo')),
  origin text not null check (origin in ('training', 'recovery', 'performance', 'schedule', 'race')),
  requested_by text not null check (requested_by in ('athlete', 'system')),
  status text not null default 'draft' check (
    status in (
      'draft', 'ready', 'accepted', 'applied', 'rejected', 'expired',
      'superseded', 'stale', 'invalid', 'reverted'
    )
  ),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  summary text check (char_length(summary) <= 500),
  rationale text check (char_length(rationale) <= 2000),
  operations jsonb not null check (jsonb_typeof(operations) = 'array'),
  preview jsonb,
  validation jsonb,
  evidence jsonb not null default '[]' check (jsonb_typeof(evidence) = 'array'),
  assumptions jsonb not null default '[]' check (jsonb_typeof(assumptions) = 'array'),
  uncertainty jsonb,
  specialist_opinions jsonb not null default '[]'
    check (jsonb_typeof(specialist_opinions) = 'array'),
  target_keys text[] not null default '{}',
  agent_run_id uuid,
  expires_at timestamptz,
  superseded_by uuid references public.plan_proposals (id) on delete set null,
  applied_version integer check (applied_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope = 'new_plan' or (plan_id is not null and base_version is not null)),
  check (scope <> 'new_plan' or base_version is null)
);

create index plan_proposals_user_id_created_at_idx
  on public.plan_proposals (user_id, created_at desc);
create index plan_proposals_plan_id_idx on public.plan_proposals (plan_id);
create index plan_proposals_superseded_by_idx on public.plan_proposals (superseded_by);
create unique index plan_proposals_one_ready_per_target
  on public.plan_proposals (
    user_id,
    coalesce(plan_id, '00000000-0000-0000-0000-000000000000'::uuid),
    target_keys
  )
  where status = 'ready';

create table public.plan_versions (
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  version integer not null check (version > 0),
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_version integer check (parent_version > 0 and parent_version < version),
  source_proposal_id uuid references public.plan_proposals (id) on delete set null,
  created_by text not null check (created_by in ('athlete', 'coach', 'system')),
  effective_from date not null,
  race_roles jsonb not null default '[]' check (jsonb_typeof(race_roles) = 'array'),
  confidence jsonb not null check (jsonb_typeof(confidence) = 'object'),
  summary text check (char_length(summary) <= 500),
  content_hash text not null,
  created_at timestamptz not null default now(),
  primary key (plan_id, version)
);

create index plan_versions_user_id_idx on public.plan_versions (user_id);
create index plan_versions_source_proposal_id_idx on public.plan_versions (source_proposal_id);

create table public.plan_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  proposal_id uuid not null references public.plan_proposals (id) on delete cascade,
  decision text not null check (
    decision in ('accepted', 'rejected', 'expired', 'superseded', 'stale', 'applied', 'reverted')
  ),
  actor text not null check (actor in ('athlete', 'system')),
  note text check (char_length(btrim(note)) between 1 and 500),
  resulting_version integer check (resulting_version > 0),
  created_at timestamptz not null default now()
);

create index plan_decisions_user_id_created_at_idx
  on public.plan_decisions (user_id, created_at desc);
create index plan_decisions_proposal_id_idx on public.plan_decisions (proposal_id);

create table public.plan_blocks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  block_key text not null check (block_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  valid_from_version integer not null check (valid_from_version > 0),
  valid_to_version integer check (valid_to_version > valid_from_version),
  kind text not null check (
    kind in ('lead_in', 'base', 'build', 'specific', 'taper', 'race', 'recovery', 'transition')
  ),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  starts_on date not null,
  ends_on date not null,
  objective text not null check (char_length(btrim(objective)) between 1 and 280),
  race_id uuid,
  check (ends_on >= starts_on)
);

create index plan_blocks_plan_id_valid_to_starts_on_idx
  on public.plan_blocks (plan_id, valid_to_version, starts_on);
create index plan_blocks_plan_id_block_key_idx on public.plan_blocks (plan_id, block_key);
create unique index plan_blocks_one_current_per_key
  on public.plan_blocks (plan_id, block_key) where valid_to_version is null;
create index plan_blocks_user_id_idx on public.plan_blocks (user_id);

create table public.plan_weeks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  week_key text not null check (week_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  valid_from_version integer not null check (valid_from_version > 0),
  valid_to_version integer check (valid_to_version > valid_from_version),
  week_start date not null check (extract(isodow from week_start) = 1),
  block_key text not null check (block_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  week_type text not null check (
    week_type in ('lead_in', 'build', 'recovery', 'taper', 'race', 'post_race')
  ),
  target_duration_s integer not null check (target_duration_s between 0 and 604800),
  target_distance_m integer check (target_distance_m between 0 and 2000000),
  target_elevation_m integer check (target_elevation_m between 0 and 50000),
  quality_sessions smallint not null check (quality_sessions between 0 and 7),
  long_run_target_s integer check (long_run_target_s between 0 and 259200),
  intensity_split jsonb not null check (jsonb_typeof(intensity_split) = 'object'),
  notes text check (char_length(btrim(notes)) between 1 and 280)
);

create index plan_weeks_plan_id_valid_to_week_start_idx
  on public.plan_weeks (plan_id, valid_to_version, week_start);
create index plan_weeks_plan_id_week_key_idx on public.plan_weeks (plan_id, week_key);
create unique index plan_weeks_one_current_per_key
  on public.plan_weeks (plan_id, week_key) where valid_to_version is null;
create index plan_weeks_user_id_idx on public.plan_weeks (user_id);

create table public.plan_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_key text not null check (session_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  valid_from_version integer not null check (valid_from_version > 0),
  valid_to_version integer check (valid_to_version > valid_from_version),
  scheduled_on date not null,
  sport text not null check (sport in ('run', 'trail', 'strength', 'cross', 'rest')),
  kind text not null check (
    kind in (
      'easy', 'long', 'recovery', 'tempo', 'threshold', 'intervals', 'hills',
      'race_specific', 'race', 'strength', 'mobility', 'cross', 'rest'
    )
  ),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  purpose text not null check (char_length(btrim(purpose)) between 1 and 280),
  is_key boolean not null,
  priority text not null check (priority in ('high', 'normal', 'low')),
  targets jsonb not null check (jsonb_typeof(targets) = 'object'),
  structure jsonb not null check (jsonb_typeof(structure) = 'array'),
  terrain text check (terrain in ('road', 'trail', 'track', 'treadmill', 'mixed')),
  origin text not null check (origin in ('template', 'coach', 'athlete')),
  contingencies jsonb not null default '[]' check (jsonb_typeof(contingencies) = 'array')
);

create index plan_sessions_plan_id_valid_to_scheduled_on_idx
  on public.plan_sessions (plan_id, valid_to_version, scheduled_on);
create index plan_sessions_plan_id_session_key_idx on public.plan_sessions (plan_id, session_key);
create unique index plan_sessions_one_current_per_key
  on public.plan_sessions (plan_id, session_key) where valid_to_version is null;
create index plan_sessions_user_id_idx on public.plan_sessions (user_id);

alter table public.training_plans enable row level security;
alter table public.plan_versions enable row level security;
alter table public.plan_blocks enable row level security;
alter table public.plan_weeks enable row level security;
alter table public.plan_sessions enable row level security;
alter table public.plan_proposals enable row level security;
alter table public.plan_decisions enable row level security;

create policy training_plans_owner_select on public.training_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy plan_versions_owner_select on public.plan_versions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy plan_blocks_owner_select on public.plan_blocks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy plan_weeks_owner_select on public.plan_weeks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy plan_sessions_owner_select on public.plan_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy plan_proposals_owner_select on public.plan_proposals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy plan_decisions_owner_select on public.plan_decisions
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.training_plans, public.plan_versions, public.plan_blocks,
  public.plan_weeks, public.plan_sessions, public.plan_proposals, public.plan_decisions
  from anon, authenticated;
revoke insert, update, delete, truncate on public.training_plans, public.plan_versions,
  public.plan_blocks, public.plan_weeks, public.plan_sessions, public.plan_proposals,
  public.plan_decisions
  from service_role;
grant select on public.training_plans, public.plan_versions, public.plan_blocks,
  public.plan_weeks, public.plan_sessions, public.plan_proposals, public.plan_decisions
  to authenticated;

create function private.apply_plan_proposal(p_proposal_id uuid, p_changeset jsonb)
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

create function private.decide_plan_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_note text
)
returns public.plan_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_proposal public.plan_proposals;
  v_note text := nullif(btrim(p_note), '');
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'PT401';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'invalid_note' using errcode = 'PT400';
  end if;

  select * into v_proposal from public.plan_proposals
    where id = p_proposal_id and user_id = v_user_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  if v_proposal.status <> 'ready'
    or (v_proposal.expires_at is not null and v_proposal.expires_at <= now()) then
    raise exception 'invalid_state' using errcode = 'PT409';
  end if;

  update public.plan_proposals set status = p_decision, updated_at = now()
    where id = v_proposal.id
    returning * into v_proposal;
  insert into public.plan_decisions (user_id, proposal_id, decision, actor, note)
    values (v_user_id, v_proposal.id, p_decision, 'athlete', v_note);

  return v_proposal;
end;
$$;

create function public.accept_plan_proposal(p_proposal_id uuid, p_note text default null)
returns public.plan_proposals
language sql
security definer
set search_path = ''
as $$
  select * from private.decide_plan_proposal(p_proposal_id, 'accepted', p_note);
$$;

create function public.reject_plan_proposal(p_proposal_id uuid, p_note text default null)
returns public.plan_proposals
language sql
security definer
set search_path = ''
as $$
  select * from private.decide_plan_proposal(p_proposal_id, 'rejected', p_note);
$$;

revoke all on function private.apply_plan_proposal(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.decide_plan_proposal(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.accept_plan_proposal(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.reject_plan_proposal(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.apply_plan_proposal(uuid, jsonb) to stride_coach_worker;
grant execute on function public.accept_plan_proposal(uuid, text) to authenticated;
grant execute on function public.reject_plan_proposal(uuid, text) to authenticated;
