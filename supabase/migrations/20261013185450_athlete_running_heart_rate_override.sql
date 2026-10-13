alter table public.athlete_profiles
  add column running_max_heart_rate_override smallint
  check (running_max_heart_rate_override between 100 and 230);

grant update (running_max_heart_rate_override)
  on public.athlete_profiles to authenticated;
