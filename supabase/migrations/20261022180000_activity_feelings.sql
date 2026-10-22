create function public.provider_activity_owned(p_activity_id uuid)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.provider_activities
    where id = p_activity_id and user_id = (select auth.uid())
  );
end;
$$;

create table public.activity_feelings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_id uuid not null,
  effort smallint not null check (effort between 1 and 10),
  feel smallint check (feel in (0, 25, 50, 75, 100)),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, activity_id)
);

create trigger activity_feelings_revision before update on public.activity_feelings
  for each row execute function public.advance_revision();

alter table public.activity_feelings enable row level security;

create policy activity_feelings_owner_select on public.activity_feelings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy activity_feelings_owner_insert on public.activity_feelings
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.provider_activity_owned(activity_id));
create policy activity_feelings_owner_update on public.activity_feelings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.provider_activity_owned(activity_id));

revoke all on public.activity_feelings from anon, authenticated;
revoke all on function public.provider_activity_owned(uuid) from public, anon;
grant execute on function public.provider_activity_owned(uuid) to authenticated;

grant select on public.activity_feelings to authenticated;
grant insert (user_id, activity_id, effort, feel)
  on public.activity_feelings to authenticated;
grant update (user_id, activity_id, effort, feel)
  on public.activity_feelings to authenticated;
