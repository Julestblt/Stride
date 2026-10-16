create policy coach_sessions_owner_delete on public.coach_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

grant delete on public.coach_sessions to authenticated;
