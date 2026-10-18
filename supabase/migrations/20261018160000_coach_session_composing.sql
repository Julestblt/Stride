alter table public.coach_sessions
  add column composing_since timestamptz;

grant update (composing_since) on public.coach_sessions to authenticated;
