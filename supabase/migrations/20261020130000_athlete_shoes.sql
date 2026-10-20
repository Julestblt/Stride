create table public.athlete_shoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  garmin_gear_uuid text check (garmin_gear_uuid ~ '^[0-9a-f]{32}$'),
  brand text not null check (char_length(brand) between 1 and 60),
  model text not null check (char_length(model) between 1 and 80),
  version text check (char_length(version) between 1 and 20),
  category text not null
    check (category in ('daily', 'tempo', 'race', 'recovery')),
  terrain text not null check (terrain in ('road', 'trail', 'mixed')),
  description text check (char_length(description) between 1 and 240),
  suggested_fields text[] not null default '{}'
    check (suggested_fields <@ array['category', 'terrain', 'description']),
  size_eu numeric(3, 1) check (size_eu between 30 and 52),
  lifespan_km smallint not null check (lifespan_km between 100 and 3000),
  starting_distance_m integer not null default 0
    check (starting_distance_m between 0 and 5000000),
  first_use_date date not null,
  retired_on date,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (retired_on is null or retired_on >= first_use_date),
  unique (user_id, garmin_gear_uuid)
);

create index athlete_shoes_user_idx on public.athlete_shoes (user_id, retired_on);

create trigger athlete_shoes_revision before update on public.athlete_shoes
  for each row execute function public.advance_revision();

alter table public.athlete_shoes enable row level security;

create policy athlete_shoes_owner_select on public.athlete_shoes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy athlete_shoes_owner_insert on public.athlete_shoes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy athlete_shoes_owner_update on public.athlete_shoes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy athlete_shoes_owner_delete on public.athlete_shoes
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.athlete_shoes from anon, authenticated;
grant select, delete on public.athlete_shoes to authenticated;
grant insert (
  user_id, garmin_gear_uuid, brand, model, version, category, terrain,
  description, suggested_fields, size_eu, lifespan_km, starting_distance_m,
  first_use_date, retired_on
) on public.athlete_shoes to authenticated;
grant update (
  brand, model, version, category, terrain, description, suggested_fields,
  size_eu, lifespan_km, starting_distance_m, first_use_date, retired_on
) on public.athlete_shoes to authenticated;
