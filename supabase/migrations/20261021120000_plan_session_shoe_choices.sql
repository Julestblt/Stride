alter table public.athlete_shoes
  add constraint athlete_shoes_id_user_key unique (id, user_id);

create table public.plan_session_shoe_choices (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_key text not null check (session_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  shoe_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, session_key),
  foreign key (shoe_id, user_id)
    references public.athlete_shoes (id, user_id) on delete cascade
);

create index plan_session_shoe_choices_shoe_idx
  on public.plan_session_shoe_choices (shoe_id, user_id);

alter table public.plan_session_shoe_choices enable row level security;

create policy plan_session_shoe_choices_owner_select
  on public.plan_session_shoe_choices
  for select to authenticated using ((select auth.uid()) = user_id);
create policy plan_session_shoe_choices_owner_insert
  on public.plan_session_shoe_choices
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy plan_session_shoe_choices_owner_update
  on public.plan_session_shoe_choices
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy plan_session_shoe_choices_owner_delete
  on public.plan_session_shoe_choices
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.plan_session_shoe_choices from anon, authenticated;
grant select, delete on public.plan_session_shoe_choices to authenticated;
grant insert (user_id, session_key, shoe_id)
  on public.plan_session_shoe_choices to authenticated;
grant update (user_id, session_key, shoe_id, updated_at)
  on public.plan_session_shoe_choices to authenticated;
