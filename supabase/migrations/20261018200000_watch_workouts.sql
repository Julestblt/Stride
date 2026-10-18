alter table public.athlete_profiles
  add column watch_workouts_enabled boolean not null default false,
  add column watch_workouts_synced_key text
    check (char_length(watch_workouts_synced_key) <= 120),
  add column watch_workouts_synced_at timestamptz;

grant update (watch_workouts_enabled, watch_workouts_synced_key, watch_workouts_synced_at)
  on public.athlete_profiles to authenticated;
