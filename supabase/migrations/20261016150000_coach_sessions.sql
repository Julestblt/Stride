create table public.coach_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  managed_session_id text not null unique
    check (managed_session_id ~ '^sesn_[A-Za-z0-9]{1,64}$'),
  mode text not null check (mode in ('conversation', 'plan')),
  status text not null default 'running' check (
    status in ('running', 'idle', 'awaiting_athlete', 'budget_reached', 'timed_out', 'failed', 'terminated')
  ),
  pending_tool_use_id text check (char_length(pending_tool_use_id) between 1 and 64),
  budget_cents integer not null check (budget_cents > 0),
  list_cost_cents integer not null default 0 check (list_cost_cents >= 0),
  last_turn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'awaiting_athlete') = (pending_tool_use_id is not null))
);

create index coach_sessions_user_recent on public.coach_sessions (user_id, created_at desc);

create function private.touch_coach_session()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger coach_sessions_touch before update on public.coach_sessions
  for each row execute function private.touch_coach_session();

alter table public.coach_sessions enable row level security;

create policy coach_sessions_owner_select on public.coach_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy coach_sessions_owner_insert on public.coach_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy coach_sessions_owner_update on public.coach_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.coach_sessions from anon, authenticated;
grant select on public.coach_sessions to authenticated;
grant insert (user_id, managed_session_id, mode, status, budget_cents)
  on public.coach_sessions to authenticated;
grant update (status, pending_tool_use_id, list_cost_cents, last_turn_at)
  on public.coach_sessions to authenticated;

create function private.clear_new_plan_proposals(p_user_id uuid)
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
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.clear_new_plan_proposals(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.clear_new_plan_proposals(uuid) to stride_coach_worker;
