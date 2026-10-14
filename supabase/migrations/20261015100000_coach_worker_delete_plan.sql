create function private.delete_plan(p_user_id uuid, p_plan_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.plan_proposals
    where user_id = p_user_id and plan_id is null and scope = 'new_plan'
      and status in ('draft', 'ready', 'accepted');
  delete from public.training_plans
    where id = p_plan_id and user_id = p_user_id;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  return v_count;
end;
$$;

revoke all on function private.delete_plan(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.delete_plan(uuid, uuid) to stride_coach_worker;
