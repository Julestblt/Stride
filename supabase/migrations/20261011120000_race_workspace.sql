create function public.race_owned(p_race_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.athlete_races
    where id = p_race_id and user_id = (select auth.uid())
  );
$$;

create table public.race_plans (
  race_id uuid primary key references public.athlete_races (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  start_time time,
  start_time_confirmed boolean not null default false,
  ambitious_duration_seconds integer check (ambitious_duration_seconds between 60 and 1209599),
  cautious_duration_seconds integer check (cautious_duration_seconds between 60 and 1209599),
  cutoff_duration_seconds integer check (cutoff_duration_seconds between 60 and 1209599),
  labels text[] not null default '{}' check (
    cardinality(labels) <= 4
    and array_position(labels, null) is null
  ),
  walk_grade_percent integer not null default 10 check (walk_grade_percent between 5 and 20),
  walk_pace_seconds_per_km integer not null default 690
    check (walk_pace_seconds_per_km between 360 and 1800),
  aid_stop_seconds integer not null default 300 check (aid_stop_seconds between 0 and 3600),
  water_stop_seconds integer not null default 120 check (water_stop_seconds between 0 and 3600),
  carbs_per_hour_g integer not null default 60 check (carbs_per_hour_g between 20 and 120),
  water_ml_per_hour integer not null default 450 check (water_ml_per_hour between 100 and 1500),
  sodium_mg_per_hour integer not null default 500 check (sodium_mg_per_hour between 0 and 2000),
  nutrition_alarm_minutes integer not null default 20
    check (nutrition_alarm_minutes between 5 and 60),
  night_caffeine boolean not null default true,
  roadbook_import jsonb check (roadbook_import is null or jsonb_typeof(roadbook_import) = 'object'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.race_courses (
  race_id uuid primary key references public.athlete_races (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('gpx', 'activity')),
  file_name text check (char_length(file_name) between 1 and 200),
  source_activity_id text check (char_length(source_activity_id) between 1 and 200),
  time_zone text not null default 'Europe/Paris' check (char_length(time_zone) between 1 and 64),
  distance_m numeric(9, 1) not null check (distance_m > 0 and distance_m <= 1000000),
  elevation_gain_m integer check (elevation_gain_m between 0 and 60000),
  elevation_loss_m integer check (elevation_loss_m between 0 and 60000),
  step_m numeric(6, 2) not null check (step_m > 0 and step_m <= 1000),
  points jsonb not null check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) between 2 and 20000),
  imported_at timestamptz not null default now(),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.race_waypoints (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.athlete_races (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (
    kind in ('start', 'finish', 'aid', 'water', 'base', 'summit', 'caution', 'instruction')
  ),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  distance_m numeric(9, 1) not null check (distance_m >= 0 and distance_m <= 1000000),
  cutoff_time time,
  services text[] not null default '{}' check (
    services <@ array['water', 'sweet', 'salty', 'hot', 'toilets', 'assistance']::text[]
  ),
  watch_label text check (char_length(watch_label) between 1 and 24),
  alert_distance_m integer not null default 500 check (alert_distance_m in (0, 200, 500, 1000)),
  voice_note text check (char_length(voice_note) <= 280),
  todo text check (char_length(todo) <= 400),
  nutrition_note text check (char_length(nutrition_note) <= 280),
  source text not null default 'athlete' check (source in ('gpx', 'roadbook', 'athlete', 'course')),
  needs_review boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index race_waypoints_race_id_distance_idx on public.race_waypoints (race_id, distance_m);
create index race_waypoints_user_id_idx on public.race_waypoints (user_id);

create table public.race_checklist_items (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.athlete_races (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  list text not null check (
    list in (
      'gear_mandatory', 'gear_night', 'gear_weather', 'gear_kit', 'gear_forbidden',
      'nutrition_tested', 'key_sessions', 'prep_week', 'prep_eve', 'prep_race_day'
    )
  ),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  detail text check (char_length(detail) <= 240),
  status text check (status in ('ready', 'check', 'buy', 'test', 'weather', 'forbidden')),
  checked boolean not null default false,
  start_date date,
  end_date date check (end_date is null or (start_date is not null and end_date >= start_date)),
  position integer not null default 0 check (position between 0 and 1000),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index race_checklist_items_race_id_list_idx on public.race_checklist_items (race_id, list, position);
create index race_checklist_items_user_id_idx on public.race_checklist_items (user_id);
create index race_plans_user_id_idx on public.race_plans (user_id);
create index race_courses_user_id_idx on public.race_courses (user_id);

create trigger race_plans_revision before update on public.race_plans
  for each row execute function public.advance_revision();
create trigger race_courses_revision before update on public.race_courses
  for each row execute function public.advance_revision();
create trigger race_waypoints_revision before update on public.race_waypoints
  for each row execute function public.advance_revision();
create trigger race_checklist_items_revision before update on public.race_checklist_items
  for each row execute function public.advance_revision();

alter table public.race_plans enable row level security;
alter table public.race_courses enable row level security;
alter table public.race_waypoints enable row level security;
alter table public.race_checklist_items enable row level security;

create policy race_plans_owner_select on public.race_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy race_plans_owner_insert on public.race_plans
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.race_owned(race_id));
create policy race_plans_owner_update on public.race_plans
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.race_owned(race_id));

create policy race_courses_owner_select on public.race_courses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy race_courses_owner_insert on public.race_courses
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.race_owned(race_id));
create policy race_courses_owner_update on public.race_courses
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.race_owned(race_id));
create policy race_courses_owner_delete on public.race_courses
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy race_waypoints_owner_select on public.race_waypoints
  for select to authenticated using ((select auth.uid()) = user_id);
create policy race_waypoints_owner_insert on public.race_waypoints
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.race_owned(race_id));
create policy race_waypoints_owner_update on public.race_waypoints
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.race_owned(race_id));
create policy race_waypoints_owner_delete on public.race_waypoints
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy race_checklist_items_owner_select on public.race_checklist_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy race_checklist_items_owner_insert on public.race_checklist_items
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.race_owned(race_id));
create policy race_checklist_items_owner_update on public.race_checklist_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.race_owned(race_id));
create policy race_checklist_items_owner_delete on public.race_checklist_items
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.race_plans, public.race_courses, public.race_waypoints, public.race_checklist_items
  from anon, authenticated;
revoke all on function public.race_owned(uuid) from public, anon;
grant execute on function public.race_owned(uuid) to authenticated;

grant select on public.race_plans, public.race_courses, public.race_waypoints, public.race_checklist_items
  to authenticated;
grant insert (
  race_id, user_id, start_time, start_time_confirmed, ambitious_duration_seconds,
  cautious_duration_seconds, cutoff_duration_seconds, labels, walk_grade_percent,
  walk_pace_seconds_per_km, aid_stop_seconds, water_stop_seconds, carbs_per_hour_g,
  water_ml_per_hour, sodium_mg_per_hour, nutrition_alarm_minutes, night_caffeine, roadbook_import
) on public.race_plans to authenticated;
grant update (
  start_time, start_time_confirmed, ambitious_duration_seconds, cautious_duration_seconds,
  cutoff_duration_seconds, labels, walk_grade_percent, walk_pace_seconds_per_km,
  aid_stop_seconds, water_stop_seconds, carbs_per_hour_g, water_ml_per_hour,
  sodium_mg_per_hour, nutrition_alarm_minutes, night_caffeine, roadbook_import
) on public.race_plans to authenticated;
grant insert (
  race_id, user_id, source, file_name, source_activity_id, time_zone, distance_m,
  elevation_gain_m, elevation_loss_m, step_m, points, imported_at
) on public.race_courses to authenticated;
grant update (
  source, file_name, source_activity_id, time_zone, distance_m, elevation_gain_m,
  elevation_loss_m, step_m, points, imported_at
) on public.race_courses to authenticated;
grant delete on public.race_courses to authenticated;
grant insert (
  id, race_id, user_id, kind, name, distance_m, cutoff_time, services, watch_label,
  alert_distance_m, voice_note, todo, nutrition_note, source, needs_review
) on public.race_waypoints to authenticated;
grant update (
  kind, name, distance_m, cutoff_time, services, watch_label, alert_distance_m,
  voice_note, todo, nutrition_note, source, needs_review
) on public.race_waypoints to authenticated;
grant delete on public.race_waypoints to authenticated;
grant insert (
  id, race_id, user_id, list, label, detail, status, checked, start_date, end_date, position
) on public.race_checklist_items to authenticated;
grant update (
  label, detail, status, checked, start_date, end_date, position
) on public.race_checklist_items to authenticated;
grant delete on public.race_checklist_items to authenticated;

create function public.replace_race_roadbook(
  p_race_id uuid,
  p_points jsonb,
  p_summary jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.race_owned(p_race_id) then
    raise exception 'race_not_owned' using errcode = '42501';
  end if;
  if jsonb_typeof(p_points) is distinct from 'array'
    or jsonb_array_length(p_points) > 80
    or jsonb_typeof(p_summary) is distinct from 'object' then
    raise exception 'invalid_roadbook' using errcode = '22023';
  end if;

  delete from public.race_waypoints
  where race_id = p_race_id and user_id = (select auth.uid()) and source = 'roadbook';

  delete from public.race_waypoints
  where race_id = p_race_id and user_id = (select auth.uid()) and source = 'gpx'
    and lower(name) in (
      select lower(point.name)
      from jsonb_to_recordset(p_points) as point(name text)
    );

  insert into public.race_waypoints (
    race_id, user_id, kind, name, distance_m, cutoff_time, services, source, needs_review
  )
  select p_race_id, (select auth.uid()), point.kind, point.name, point.distance_m,
    point.cutoff_time, point.services, 'roadbook', point.needs_review
  from jsonb_to_recordset(p_points) as point(
    kind text, name text, distance_m numeric, cutoff_time time,
    services text[], needs_review boolean
  );

  insert into public.race_plans (race_id, user_id, roadbook_import)
  values (p_race_id, (select auth.uid()), p_summary)
  on conflict (race_id) do update set roadbook_import = excluded.roadbook_import;
end;
$$;

revoke all on function public.replace_race_roadbook(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.replace_race_roadbook(uuid, jsonb, jsonb) to authenticated;

create function public.replace_race_course(
  p_race_id uuid,
  p_source text,
  p_file_name text,
  p_time_zone text,
  p_distance_m numeric,
  p_step_m numeric,
  p_points jsonb,
  p_waypoints jsonb,
  p_source_activity_id text default null,
  p_elevation_gain_m integer default null,
  p_elevation_loss_m integer default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_replacing boolean;
  v_count integer;
begin
  if not public.race_owned(p_race_id) then
    raise exception 'race_not_owned' using errcode = '42501';
  end if;
  if jsonb_typeof(p_waypoints) is distinct from 'array'
    or jsonb_array_length(p_waypoints) > 80 then
    raise exception 'invalid_waypoints' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.race_courses where race_id = p_race_id
  ) into v_replacing;

  insert into public.race_courses (
    race_id, user_id, source, file_name, source_activity_id, time_zone,
    distance_m, elevation_gain_m, elevation_loss_m, step_m, points, imported_at
  ) values (
    p_race_id, (select auth.uid()), p_source, p_file_name, p_source_activity_id,
    p_time_zone, p_distance_m, p_elevation_gain_m, p_elevation_loss_m,
    p_step_m, p_points, now()
  ) on conflict (race_id) do update set
    source = excluded.source,
    file_name = excluded.file_name,
    source_activity_id = excluded.source_activity_id,
    time_zone = excluded.time_zone,
    distance_m = excluded.distance_m,
    elevation_gain_m = excluded.elevation_gain_m,
    elevation_loss_m = excluded.elevation_loss_m,
    step_m = excluded.step_m,
    points = excluded.points,
    imported_at = excluded.imported_at;

  delete from public.race_waypoints
  where race_id = p_race_id and user_id = (select auth.uid())
    and source in ('gpx', 'course');

  if v_replacing then
    update public.race_waypoints
    set distance_m = least(distance_m, p_distance_m), needs_review = true
    where race_id = p_race_id and user_id = (select auth.uid());
  end if;

  insert into public.race_waypoints (
    race_id, user_id, kind, name, distance_m, source, needs_review
  ) values
    (p_race_id, (select auth.uid()), 'start', 'Départ', 0, 'course', false),
    (p_race_id, (select auth.uid()), 'finish', 'Arrivée', p_distance_m, 'course', false);

  insert into public.race_waypoints (
    race_id, user_id, kind, name, distance_m, todo, source, needs_review
  )
  select p_race_id, (select auth.uid()), point.kind, point.name, point.distance_m,
    point.todo, 'gpx', point.needs_review
  from jsonb_to_recordset(p_waypoints) as point(
    kind text, name text, distance_m numeric, todo text, needs_review boolean
  );

  get diagnostics v_count = row_count;
  return v_count + 2;
end;
$$;

revoke all on function public.replace_race_course(
  uuid, text, text, text, numeric, numeric, jsonb, jsonb, text, integer, integer
) from public, anon;
grant execute on function public.replace_race_course(
  uuid, text, text, text, numeric, numeric, jsonb, jsonb, text, integer, integer
) to authenticated;
