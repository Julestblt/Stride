alter table public.coach_sessions
  add column title text check (char_length(title) between 1 and 120),
  add column last_activity_at timestamptz not null default now(),
  add column read_at timestamptz;

create index coach_sessions_user_activity on public.coach_sessions (user_id, last_activity_at desc);

grant insert (title) on public.coach_sessions to authenticated;
grant update (last_activity_at, read_at) on public.coach_sessions to authenticated;

create table public.coach_thread_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  coach_session_id uuid not null references public.coach_sessions (id) on delete cascade,
  kind text not null check (
    kind in ('athlete', 'answer', 'coach', 'consult_request', 'consult_reply', 'consult_note',
      'consult_end', 'read', 'question', 'proposal', 'error')
  ),
  body jsonb not null check (jsonb_typeof(body) = 'object' and octet_length(body::text) <= 32768),
  created_at timestamptz not null default now()
);

create index coach_thread_items_session on public.coach_thread_items (coach_session_id, id);
create index coach_thread_items_user on public.coach_thread_items (user_id);

alter table public.coach_thread_items enable row level security;

create policy coach_thread_items_owner_select on public.coach_thread_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy coach_thread_items_owner_insert on public.coach_thread_items
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.coach_sessions
      where coach_sessions.id = coach_session_id and coach_sessions.user_id = (select auth.uid())
    )
  );

revoke all on public.coach_thread_items from anon, authenticated;
grant select on public.coach_thread_items to authenticated;
grant insert (user_id, coach_session_id, kind, body) on public.coach_thread_items to authenticated;
