create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('plan_proposal', 'staff_reply', 'staff_question')),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  payload jsonb not null default '{}'
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 4096),
  occurred_at timestamptz not null default now(),
  read_at timestamptz,
  resolved_at timestamptz,
  resolution text check (resolution in ('applied', 'rejected', 'replaced', 'answered')),
  check ((resolved_at is null) = (resolution is null)),
  unique (user_id, dedupe_key)
);

create index notifications_user_recent on public.notifications (user_id, occurred_at desc);

alter table public.notifications enable row level security;

create policy notifications_owner_select on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy notifications_owner_update on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create function private.notification_excerpt(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_text is null or btrim(p_text) = '' then null
    when char_length(regexp_replace(btrim(p_text), '\s+', ' ', 'g')) <= 200
      then regexp_replace(btrim(p_text), '\s+', ' ', 'g')
    else rtrim(left(regexp_replace(btrim(p_text), '\s+', ' ', 'g'), 199)) || '…'
  end;
$$;

create function private.notify_plan_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.notifications
      where user_id = old.user_id and dedupe_key = 'plan_proposal:' || old.id;
    return null;
  end if;
  if new.status = 'ready' and (tg_op = 'INSERT' or old.status is distinct from 'ready') then
    insert into public.notifications (user_id, kind, dedupe_key, payload, occurred_at)
    values (
      new.user_id, 'plan_proposal', 'plan_proposal:' || new.id,
      jsonb_build_object(
        'proposalId', new.id,
        'title', new.title,
        'summary', private.notification_excerpt(new.summary),
        'scope', new.scope,
        'origin', new.origin
      ),
      now()
    )
    on conflict (user_id, dedupe_key) do update set
      payload = excluded.payload,
      occurred_at = excluded.occurred_at,
      read_at = null,
      resolved_at = null,
      resolution = null;
  elsif tg_op = 'UPDATE' and old.status = 'ready' and new.status <> 'ready' then
    update public.notifications set
      resolved_at = now(),
      resolution = case
        when new.status in ('applied', 'accepted') then 'applied'
        when new.status = 'rejected' then 'rejected'
        else 'replaced'
      end,
      read_at = case
        when new.status in ('applied', 'accepted', 'rejected') then coalesce(read_at, now())
        else read_at
      end
    where user_id = new.user_id
      and dedupe_key = 'plan_proposal:' || new.id
      and resolved_at is null;
  elsif tg_op = 'UPDATE' and old.status = 'accepted' and new.status in ('stale', 'invalid') then
    update public.notifications set resolution = 'replaced'
    where user_id = new.user_id
      and dedupe_key = 'plan_proposal:' || new.id
      and resolution = 'applied';
  end if;
  return null;
end;
$$;

revoke all on function private.notify_plan_proposal() from public, anon, authenticated;

create trigger plan_proposals_notify
  after insert or update of status or delete on public.plan_proposals
  for each row execute function private.notify_plan_proposal();

create function private.notify_coach_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_text text;
  v_question jsonb;
begin
  if tg_op = 'DELETE' then
    delete from public.notifications
      where user_id = old.user_id
        and kind in ('staff_reply', 'staff_question')
        and payload ->> 'threadId' = old.id::text;
    return null;
  end if;

  if new.title is not null and old.status = 'running' and new.status = 'idle' then
    select private.notification_excerpt(body ->> 'text') into v_text
      from public.coach_thread_items
      where coach_session_id = new.id
        and kind = 'coach'
        and created_at >= old.last_activity_at
        and btrim(coalesce(body ->> 'text', '')) <> ''
      order by id desc
      limit 1;
    if v_text is not null then
      insert into public.notifications (user_id, kind, dedupe_key, payload, occurred_at)
      values (
        new.user_id, 'staff_reply', 'staff_reply:' || new.id,
        jsonb_build_object(
          'threadId', new.id,
          'threadTitle', new.title,
          'agent', 'coach',
          'excerpt', v_text
        ),
        now()
      )
      on conflict (user_id, dedupe_key) do update set
        payload = excluded.payload,
        occurred_at = excluded.occurred_at,
        read_at = null;
    end if;
  end if;

  if old.pending_tool_use_id is not null
    and new.pending_tool_use_id is distinct from old.pending_tool_use_id then
    update public.notifications set
      resolved_at = now(),
      resolution = 'answered',
      read_at = coalesce(read_at, now())
    where user_id = new.user_id
      and dedupe_key = 'staff_question:' || new.id || ':' || old.pending_tool_use_id
      and resolved_at is null;
  end if;

  if new.title is not null
    and new.status = 'awaiting_athlete'
    and new.pending_tool_use_id is distinct from old.pending_tool_use_id then
    select body into v_question
      from public.coach_thread_items
      where coach_session_id = new.id
        and kind = 'question'
        and body ->> 'toolUseId' = new.pending_tool_use_id
      order by id desc
      limit 1;
    insert into public.notifications (user_id, kind, dedupe_key, payload, occurred_at)
    values (
      new.user_id, 'staff_question',
      'staff_question:' || new.id || ':' || new.pending_tool_use_id,
      jsonb_build_object(
        'threadId', new.id,
        'threadTitle', new.title,
        'agent', coalesce(v_question ->> 'askedFor', 'coach'),
        'toolUseId', new.pending_tool_use_id,
        'question', private.notification_excerpt(v_question ->> 'question')
      ),
      now()
    )
    on conflict (user_id, dedupe_key) do nothing;
  end if;

  if new.read_at is not null and new.read_at is distinct from old.read_at then
    update public.notifications set read_at = new.read_at
      where user_id = new.user_id
        and kind in ('staff_reply', 'staff_question')
        and payload ->> 'threadId' = new.id::text
        and read_at is null;
  end if;
  return null;
end;
$$;

revoke all on function private.notify_coach_session() from public, anon, authenticated;

create trigger coach_sessions_notify
  after update of status, pending_tool_use_id, read_at or delete on public.coach_sessions
  for each row execute function private.notify_coach_session();

insert into public.notifications (user_id, kind, dedupe_key, payload, occurred_at)
select
  p.user_id, 'plan_proposal', 'plan_proposal:' || p.id,
  jsonb_build_object(
    'proposalId', p.id,
    'title', p.title,
    'summary', private.notification_excerpt(p.summary),
    'scope', p.scope,
    'origin', p.origin
  ),
  p.updated_at
from public.plan_proposals p
where p.status = 'ready'
on conflict (user_id, dedupe_key) do nothing;

insert into public.notifications (user_id, kind, dedupe_key, payload, occurred_at, read_at)
select
  s.user_id, 'staff_question',
  'staff_question:' || s.id || ':' || s.pending_tool_use_id,
  jsonb_build_object(
    'threadId', s.id,
    'threadTitle', s.title,
    'agent', coalesce(q.body ->> 'askedFor', 'coach'),
    'toolUseId', s.pending_tool_use_id,
    'question', private.notification_excerpt(q.body ->> 'question')
  ),
  s.last_activity_at,
  case when s.read_at >= s.last_activity_at then s.read_at end
from public.coach_sessions s
left join lateral (
  select i.body
  from public.coach_thread_items i
  where i.coach_session_id = s.id
    and i.kind = 'question'
    and i.body ->> 'toolUseId' = s.pending_tool_use_id
  order by i.id desc
  limit 1
) q on true
where s.status = 'awaiting_athlete' and s.title is not null
on conflict (user_id, dedupe_key) do nothing;
