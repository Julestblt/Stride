alter table public.athlete_profiles
  add column time_zone text not null default 'Europe/Paris'
    check (char_length(time_zone) between 1 and 64 and time_zone ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)+$'),
  add column max_weekly_minutes smallint
    check (max_weekly_minutes between 60 and 2400);

grant insert (time_zone, max_weekly_minutes) on public.athlete_profiles to authenticated;
grant update (time_zone, max_weekly_minutes) on public.athlete_profiles to authenticated;

create table public.athlete_unavailability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  kind text not null default 'other' check (kind in ('travel', 'rest', 'other')),
  reason text check (char_length(btrim(reason)) between 1 and 120),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (ends_on - starts_on <= 365)
);

create index athlete_unavailability_user_id_starts_on_idx
  on public.athlete_unavailability (user_id, starts_on);

create trigger athlete_unavailability_revision before update on public.athlete_unavailability
  for each row execute function public.advance_revision();

alter table public.athlete_unavailability enable row level security;

create policy athlete_unavailability_owner_select on public.athlete_unavailability
  for select to authenticated using ((select auth.uid()) = user_id);
create policy athlete_unavailability_owner_insert on public.athlete_unavailability
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy athlete_unavailability_owner_update on public.athlete_unavailability
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy athlete_unavailability_owner_delete on public.athlete_unavailability
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.athlete_unavailability from anon, authenticated;
grant select, delete on public.athlete_unavailability to authenticated;
grant insert (user_id, starts_on, ends_on, kind, reason)
  on public.athlete_unavailability to authenticated;
grant update (starts_on, ends_on, kind, reason)
  on public.athlete_unavailability to authenticated;
