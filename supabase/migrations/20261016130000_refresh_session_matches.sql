alter table public.training_plans
  add column matches_computed_at timestamptz,
  add column matches_version integer check (matches_version > 0),
  add column matches_activities_through timestamptz;

create function public.refresh_session_matches(
  p_plan_id uuid,
  p_version integer,
  p_matches jsonb,
  p_algorithm_version text,
  p_activities_through timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.training_plans;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'PT401';
  end if;
  select * into v_plan from public.training_plans
    where id = p_plan_id and user_id = v_user_id and status = 'active' for update;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  if v_plan.active_version is distinct from p_version then
    raise exception 'stale_version' using errcode = 'PT409';
  end if;

  v_count := private.record_session_matches(v_plan.id, p_matches, p_algorithm_version);

  update public.training_plans
    set matches_computed_at = now(), matches_version = v_plan.active_version,
      matches_activities_through = p_activities_through
    where id = v_plan.id;
  return v_count;
end;
$$;

revoke all on function public.refresh_session_matches(uuid, integer, jsonb, text, timestamptz)
  from public, anon, service_role;
grant execute on function public.refresh_session_matches(uuid, integer, jsonb, text, timestamptz)
  to authenticated;
