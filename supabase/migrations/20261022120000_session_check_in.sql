alter table public.session_activity_matches
  drop constraint session_activity_matches_status_check,
  drop constraint session_activity_matches_check,
  drop constraint session_activity_matches_check1;

alter table public.session_activity_matches
  add constraint session_activity_matches_status_check
    check (status in ('completed', 'partial', 'substituted', 'dismissed', 'checked_in')),
  add constraint session_activity_matches_activity_check
    check ((activity_id is null) = (status in ('dismissed', 'checked_in'))),
  add constraint session_activity_matches_athlete_status_check
    check (status not in ('dismissed', 'checked_in') or method = 'athlete');

create function public.check_in_session(p_plan_id uuid, p_session_key text)
returns setof public.session_activity_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.plan_sessions := private.owned_current_session(p_plan_id, p_session_key);
  v_today date;
begin
  if v_session.kind <> 'mobility' then
    raise exception 'not_checkable' using errcode = 'PT400';
  end if;
  select (now() at time zone p.time_zone)::date into v_today
    from public.training_plans p where p.id = p_plan_id;
  if v_session.scheduled_on > v_today then
    raise exception 'not_due' using errcode = 'PT400';
  end if;

  delete from public.session_activity_matches
    where plan_id = p_plan_id and session_key = p_session_key;

  return query
  insert into public.session_activity_matches (
    user_id, plan_id, session_key, session_revision_id, activity_id, method, confidence, status
  ) values (
    v_session.user_id, p_plan_id, p_session_key, v_session.id, null, 'athlete', 1, 'checked_in'
  ) returning *;
end;
$$;

revoke all on function public.check_in_session(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.check_in_session(uuid, text) to authenticated;
