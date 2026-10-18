create table public.athlete_condition_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('pain', 'illness', 'fatigue', 'other')),
  body_area text check (
    body_area in (
      'foot', 'ankle', 'achilles', 'calf', 'shin', 'knee', 'thigh',
      'hamstring', 'hip', 'groin', 'lower_back', 'upper_body', 'other'
    )
  ),
  severity smallint not null check (severity between 0 and 10),
  started_on date not null,
  status text not null default 'active'
    check (status in ('active', 'monitoring', 'resolved')),
  resolved_on date,
  worsening boolean not null default false,
  systemic_symptoms boolean not null default false,
  red_flag boolean not null default false,
  note text check (char_length(note) <= 280),
  source text not null default 'athlete'
    check (source in ('athlete', 'coach_confirmed')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'resolved') = (resolved_on is not null)),
  check (resolved_on is null or resolved_on >= started_on)
);

create index athlete_condition_reports_open_idx
  on public.athlete_condition_reports (user_id, started_on desc)
  where status <> 'resolved';

create trigger athlete_condition_reports_revision before update on public.athlete_condition_reports
  for each row execute function public.advance_revision();

alter table public.athlete_condition_reports enable row level security;

create policy athlete_condition_reports_owner_select on public.athlete_condition_reports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy athlete_condition_reports_owner_insert on public.athlete_condition_reports
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy athlete_condition_reports_owner_update on public.athlete_condition_reports
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy athlete_condition_reports_owner_delete on public.athlete_condition_reports
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.athlete_condition_reports from anon, authenticated;
grant select, delete on public.athlete_condition_reports to authenticated;
grant insert (
  user_id, kind, body_area, severity, started_on, status, resolved_on,
  worsening, systemic_symptoms, red_flag, note, source
) on public.athlete_condition_reports to authenticated;
grant update (
  body_area, severity, status, resolved_on, worsening, systemic_symptoms,
  red_flag, note
) on public.athlete_condition_reports to authenticated;
