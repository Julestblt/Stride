create function public.apply_accepted_plan_proposal(p_proposal_id uuid, p_changeset jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'PT401';
  end if;
  if not exists (
    select 1 from public.plan_proposals
      where id = p_proposal_id and user_id = auth.uid()
  ) then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  return (private.apply_plan_proposal(p_proposal_id, p_changeset)).version;
end;
$$;

create function public.record_plan_proposal_outcome(
  p_proposal_id uuid,
  p_outcome text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'PT401';
  end if;
  perform private.mark_plan_proposal_outcome(auth.uid(), p_proposal_id, p_outcome, p_note);
end;
$$;

create function public.reset_own_plan(p_plan_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'PT401';
  end if;
  if p_plan_id is null then
    perform private.clear_new_plan_proposals(auth.uid());
  else
    perform private.delete_plan(auth.uid(), p_plan_id);
  end if;
end;
$$;

revoke all on function public.apply_accepted_plan_proposal(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.record_plan_proposal_outcome(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.reset_own_plan(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_accepted_plan_proposal(uuid, jsonb) to authenticated;
grant execute on function public.record_plan_proposal_outcome(uuid, text, text) to authenticated;
grant execute on function public.reset_own_plan(uuid) to authenticated;
