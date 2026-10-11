alter table public.athlete_races
  add column race_kind text not null default 'road'
  check (race_kind in ('road', 'trail'));

update public.athlete_races
set race_kind = case
  when distance_km in (5, 10, 21.1, 42.2)
    and (elevation_gain_m is null or elevation_gain_m <= distance_km * 20)
  then 'road'
  else 'trail'
end;
