create table public.onboarding_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_step text not null default 'welcome'
    check (current_step in ('welcome', 'garmin', 'history', 'about', 'goals', 'profile')),
  welcome_completed_at timestamptz,
  garmin_completed_at timestamptz,
  history_completed_at timestamptz,
  about_completed_at timestamptz,
  goals_completed_at timestamptz,
  profile_completed_at timestamptz,
  completed_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    completed_at is null or (
      welcome_completed_at is not null and garmin_completed_at is not null
      and history_completed_at is not null and about_completed_at is not null
      and goals_completed_at is not null and profile_completed_at is not null
    )
  )
);

create table public.athlete_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (char_length(btrim(first_name)) between 1 and 80),
  birth_date date check (birth_date >= date '1900-01-01'),
  sex text check (sex in ('female', 'male', 'unspecified')),
  height_cm numeric(4, 1) check (height_cm between 100 and 250),
  weight_kg numeric(4, 1) check (weight_kg between 25 and 250),
  primary_terrain text check (primary_terrain in ('road', 'trail', 'mixed')),
  available_weekdays smallint[] check (
    available_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    and cardinality(available_weekdays) <= 7
  ),
  long_run_day text check (long_run_day in ('saturday', 'sunday', 'flexible')),
  weekday_session_minutes smallint check (weekday_session_minutes in (45, 60, 75, 90)),
  training_access text[] check (
    training_access <@ array['hills', 'incline_treadmill', 'gym', 'track']
  ),
  value_sources jsonb not null default '{}'::jsonb
    check (jsonb_typeof(value_sources) = 'object'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.athlete_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  focus text not null check (
    focus in ('general_fitness', 'faster', 'short_distance', 'half_marathon_marathon', 'trail', 'ultra_trail')
  ),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.athlete_races (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text check (char_length(btrim(name)) between 1 and 120),
  race_date date,
  distance_km numeric(6, 2) check (distance_km > 0 and distance_km <= 1000),
  elevation_gain_m integer check (elevation_gain_m between 0 and 30000),
  priority text not null default 'A' check (priority in ('A', 'B', 'C')),
  target_duration_seconds integer check (target_duration_seconds between 1 and 1209599),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index athlete_races_user_id_race_date_idx on public.athlete_races (user_id, race_date);

create function public.advance_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger onboarding_progress_revision before update on public.onboarding_progress
  for each row execute function public.advance_revision();
create trigger athlete_profiles_revision before update on public.athlete_profiles
  for each row execute function public.advance_revision();
create trigger athlete_goals_revision before update on public.athlete_goals
  for each row execute function public.advance_revision();
create trigger athlete_races_revision before update on public.athlete_races
  for each row execute function public.advance_revision();

alter table public.onboarding_progress enable row level security;
alter table public.athlete_profiles enable row level security;
alter table public.athlete_goals enable row level security;
alter table public.athlete_races enable row level security;

create policy onboarding_progress_owner_select on public.onboarding_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy onboarding_progress_owner_insert on public.onboarding_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy onboarding_progress_owner_update on public.onboarding_progress
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy athlete_profiles_owner_select on public.athlete_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy athlete_profiles_owner_insert on public.athlete_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy athlete_profiles_owner_update on public.athlete_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy athlete_goals_owner_select on public.athlete_goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy athlete_goals_owner_insert on public.athlete_goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy athlete_goals_owner_update on public.athlete_goals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy athlete_races_owner_select on public.athlete_races
  for select to authenticated using ((select auth.uid()) = user_id);
create policy athlete_races_owner_insert on public.athlete_races
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy athlete_races_owner_update on public.athlete_races
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy athlete_races_owner_delete on public.athlete_races
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.onboarding_progress, public.athlete_profiles, public.athlete_goals, public.athlete_races
  from anon, authenticated;
revoke all on function public.advance_revision() from public, anon, authenticated;

grant select on public.onboarding_progress, public.athlete_profiles, public.athlete_goals, public.athlete_races
  to authenticated;
grant insert (user_id) on public.onboarding_progress to authenticated;
grant insert (
  user_id, first_name, birth_date, sex, height_cm, weight_kg, primary_terrain,
  available_weekdays, long_run_day, weekday_session_minutes, training_access, value_sources
) on public.athlete_profiles to authenticated;
grant update (
  first_name, birth_date, sex, height_cm, weight_kg, primary_terrain,
  available_weekdays, long_run_day, weekday_session_minutes, training_access, value_sources
) on public.athlete_profiles to authenticated;
grant insert (user_id, focus) on public.athlete_goals to authenticated;
grant update (focus) on public.athlete_goals to authenticated;
grant insert (
  id, user_id, name, race_date, distance_km, elevation_gain_m, priority, target_duration_seconds
) on public.athlete_races to authenticated;
grant update (
  name, race_date, distance_km, elevation_gain_m, priority, target_duration_seconds
) on public.athlete_races to authenticated;
grant delete on public.athlete_races to authenticated;

create schema private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create function private.apply_onboarding_completion(
  p_user_id uuid,
  p_step text,
  p_expected_revision integer
)
returns public.onboarding_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_progress public.onboarding_progress;
  v_missing text[];
begin
  if p_step is null or p_step not in ('welcome', 'garmin', 'history', 'about', 'goals', 'profile') then
    raise exception 'unknown_step' using errcode = 'PT400';
  end if;

  select * into v_progress from public.onboarding_progress
    where user_id = p_user_id for update;
  if not found then
    raise exception 'onboarding_not_started' using errcode = 'PT404';
  end if;
  if p_expected_revision is null or v_progress.revision <> p_expected_revision then
    raise exception 'revision_conflict' using errcode = 'PT409';
  end if;

  v_missing := array_remove(array[
    case when p_step = 'garmin' and v_progress.welcome_completed_at is null then 'welcome' end,
    case when p_step in ('history', 'about') and v_progress.garmin_completed_at is null then 'garmin' end,
    case when p_step = 'goals' and v_progress.about_completed_at is null then 'about' end,
    case when p_step = 'profile' and v_progress.goals_completed_at is null then 'goals' end,
    case when p_step = 'profile' and v_progress.history_completed_at is null then 'history' end
  ], null);
  if cardinality(v_missing) > 0 then
    raise exception 'prerequisites_incomplete' using errcode = 'PT422',
      detail = array_to_string(v_missing, ',');
  end if;

  if p_step = 'about' and not exists (
    select 1 from public.athlete_profiles
    where user_id = p_user_id
      and first_name is not null and birth_date is not null and sex is not null
      and height_cm is not null and weight_kg is not null and primary_terrain is not null
      and cardinality(available_weekdays) > 0 and long_run_day is not null
      and weekday_session_minutes is not null
  ) then
    raise exception 'step_data_incomplete' using errcode = 'PT422', detail = 'about';
  end if;

  if p_step = 'goals' and (
    not exists (select 1 from public.athlete_goals where user_id = p_user_id)
    or exists (
      select 1 from public.athlete_races
      where user_id = p_user_id and (name is null or race_date is null or distance_km is null)
    )
  ) then
    raise exception 'step_data_incomplete' using errcode = 'PT422', detail = 'goals';
  end if;

  update public.onboarding_progress set
    welcome_completed_at = case when p_step = 'welcome' then coalesce(welcome_completed_at, now()) else welcome_completed_at end,
    garmin_completed_at = case when p_step = 'garmin' then coalesce(garmin_completed_at, now()) else garmin_completed_at end,
    history_completed_at = case when p_step = 'history' then coalesce(history_completed_at, now()) else history_completed_at end,
    about_completed_at = case when p_step = 'about' then coalesce(about_completed_at, now()) else about_completed_at end,
    goals_completed_at = case when p_step = 'goals' then coalesce(goals_completed_at, now()) else goals_completed_at end,
    profile_completed_at = case when p_step = 'profile' then coalesce(profile_completed_at, now()) else profile_completed_at end,
    completed_at = case when p_step = 'profile' then coalesce(completed_at, now()) else completed_at end,
    current_step = case p_step
      when 'welcome' then 'garmin'
      when 'garmin' then 'history'
      when 'history' then 'about'
      when 'about' then 'goals'
      else 'profile'
    end
  where user_id = p_user_id
  returning * into v_progress;

  return v_progress;
end;
$$;

revoke all on function private.apply_onboarding_completion(uuid, text, integer)
  from public, anon, authenticated, service_role;

create function public.complete_onboarding_step(p_step text, p_expected_revision integer)
returns public.onboarding_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'PT401';
  end if;
  if p_step is null or p_step not in ('welcome', 'garmin', 'history', 'about', 'goals', 'profile') then
    raise exception 'unknown_step' using errcode = 'PT400';
  end if;
  if p_step not in ('welcome', 'history', 'about', 'goals') then
    raise exception 'server_validation_required' using errcode = 'PT403';
  end if;

  return private.apply_onboarding_completion(v_user_id, p_step, p_expected_revision);
end;
$$;

create function public.complete_onboarding_step_server(
  p_user_id uuid,
  p_step text,
  p_expected_revision integer
)
returns public.onboarding_progress
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'server_role_required' using errcode = 'PT403';
  end if;
  if p_step is null or p_step not in ('garmin', 'profile') then
    raise exception 'invalid_server_step' using errcode = 'PT400';
  end if;

  return private.apply_onboarding_completion(p_user_id, p_step, p_expected_revision);
end;
$$;

create function public.set_onboarding_current_step(p_step text, p_expected_revision integer)
returns public.onboarding_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_progress public.onboarding_progress;
  v_allowed boolean;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'PT401';
  end if;
  if p_step is null or p_step not in ('welcome', 'garmin', 'history', 'about', 'goals', 'profile') then
    raise exception 'unknown_step' using errcode = 'PT400';
  end if;

  select * into v_progress
  from public.onboarding_progress
  where user_id = v_user_id
  for update;
  if not found then
    raise exception 'onboarding_not_started' using errcode = 'PT404';
  end if;
  if p_expected_revision is null or v_progress.revision <> p_expected_revision then
    raise exception 'revision_conflict' using errcode = 'PT409';
  end if;

  v_allowed := case p_step
    when 'welcome' then true
    when 'garmin' then v_progress.welcome_completed_at is not null
    when 'history' then v_progress.garmin_completed_at is not null
    when 'about' then v_progress.garmin_completed_at is not null
    when 'goals' then v_progress.about_completed_at is not null
    when 'profile' then v_progress.goals_completed_at is not null
      and v_progress.history_completed_at is not null
  end;
  if not v_allowed then
    raise exception 'prerequisites_incomplete' using errcode = 'PT422';
  end if;

  update public.onboarding_progress
  set current_step = p_step
  where user_id = v_user_id
  returning * into v_progress;

  return v_progress;
end;
$$;

revoke all on function public.complete_onboarding_step(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_onboarding_step_server(uuid, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.set_onboarding_current_step(text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_onboarding_step(text, integer) to authenticated;
grant execute on function public.complete_onboarding_step_server(uuid, text, integer) to service_role;
grant execute on function public.set_onboarding_current_step(text, integer) to authenticated;
