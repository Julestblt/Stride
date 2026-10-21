create table public.activity_shoe_decisions (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_activity_id text not null
    check (char_length(provider_activity_id) between 1 and 64),
  decision text not null
    check (decision in ('confirmed', 'corrected', 'assigned', 'unassignable')),
  shoe_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider_activity_id),
  foreign key (shoe_id, user_id)
    references public.athlete_shoes (id, user_id) on delete set null (shoe_id)
);

create index activity_shoe_decisions_shoe_idx
  on public.activity_shoe_decisions (shoe_id, user_id);

alter table public.activity_shoe_decisions enable row level security;

create policy activity_shoe_decisions_owner_select
  on public.activity_shoe_decisions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy activity_shoe_decisions_owner_insert
  on public.activity_shoe_decisions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy activity_shoe_decisions_owner_update
  on public.activity_shoe_decisions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy activity_shoe_decisions_owner_delete
  on public.activity_shoe_decisions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.activity_shoe_decisions from anon, authenticated;
grant select, delete on public.activity_shoe_decisions to authenticated;
grant insert (user_id, provider_activity_id, decision, shoe_id)
  on public.activity_shoe_decisions to authenticated;
grant update (user_id, provider_activity_id, decision, shoe_id, updated_at)
  on public.activity_shoe_decisions to authenticated;
