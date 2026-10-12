create table public.athlete_wellness_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  checkin_date date not null,
  legs text check (legs in ('heavy', 'normal', 'fresh')),
  soreness text check (soreness in ('none', 'light', 'marked')),
  stress text check (stress in ('low', 'normal', 'high')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);

create trigger athlete_wellness_checkins_revision before update on public.athlete_wellness_checkins
  for each row execute function public.advance_revision();

alter table public.athlete_wellness_checkins enable row level security;

create policy athlete_wellness_checkins_owner_select on public.athlete_wellness_checkins
  for select to authenticated using ((select auth.uid()) = user_id);
create policy athlete_wellness_checkins_owner_insert on public.athlete_wellness_checkins
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy athlete_wellness_checkins_owner_update on public.athlete_wellness_checkins
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.athlete_wellness_checkins from anon, authenticated;
grant select on public.athlete_wellness_checkins to authenticated;
grant insert (user_id, checkin_date, legs, soreness, stress)
  on public.athlete_wellness_checkins to authenticated;
grant update (user_id, checkin_date, legs, soreness, stress)
  on public.athlete_wellness_checkins to authenticated;
