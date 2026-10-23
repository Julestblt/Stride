create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique
    check (char_length(endpoint) between 1 and 2048 and endpoint ~ '^https://'),
  p256dh text not null check (char_length(p256dh) between 1 and 256),
  auth text not null check (char_length(auth) between 1 and 128),
  label text check (char_length(btrim(label)) between 1 and 60),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_owner_select on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy push_subscriptions_owner_delete on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

create table public.push_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  session_reminder boolean not null default true,
  plan_staff boolean not null default true,
  debrief boolean not null default true,
  garmin_issues boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.push_preferences enable row level security;

create policy push_preferences_owner_select on public.push_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy push_preferences_owner_insert on public.push_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy push_preferences_owner_update on public.push_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.push_preferences from anon, authenticated;
grant select, insert, update on public.push_preferences to authenticated;

create table public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_id uuid references public.notifications (id) on delete cascade,
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 300),
  kind text not null check (char_length(kind) between 1 and 40),
  payload jsonb not null default '{}'
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 8192),
  occurred_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'delivered', 'failed')),
  attempts smallint not null default 0 check (attempts between 0 and 3),
  request_id bigint,
  dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'sent') = (request_id is not null)),
  unique (subscription_id, dedupe_key)
);

create index push_deliveries_user_id_idx on public.push_deliveries (user_id);
create index push_deliveries_notification_id_idx on public.push_deliveries (notification_id);
create index push_deliveries_open_idx on public.push_deliveries (status, occurred_at)
  where status in ('pending', 'sent');

alter table public.push_deliveries enable row level security;

revoke all on public.push_deliveries from anon, authenticated;

create function private.is_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    substring(p_endpoint from '^https://([^/:?#]+)') ~
      '^([^.]+\.)*(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$',
    false
  );
$$;

revoke all on function private.is_push_endpoint(text) from public, anon, authenticated;

create function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not private.is_push_endpoint(p_endpoint) then
    raise exception 'Unsupported push endpoint' using errcode = '22023';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id <> v_user;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, label)
  values (v_user, p_endpoint, p_p256dh, p_auth, nullif(btrim(p_label), ''))
  on conflict (endpoint) do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    label = excluded.label
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

create function private.reconcile_garmin_notifications_for(
  p_user uuid,
  p_gear_mismatches jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := p_user;
  v_since timestamptz := now() - interval '30 days';
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_uuid text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_connection record;
  v_gear jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_gear_mismatches is not null and jsonb_typeof(p_gear_mismatches) <> 'array' then
    raise exception 'Gear mismatches must be an array' using errcode = '22023';
  end if;

  insert into public.notifications (user_id, kind, dedupe_key, payload, occurred_at)
  select
    v_user, 'garmin_activity', 'garmin_activity:' || a.id,
    jsonb_build_object(
      'activityId', a.id,
      'name', private.notification_excerpt(a.activity_name),
      'type', a.activity_type,
      'distanceMeters', a.distance_meters,
      'durationSeconds', a.duration_seconds,
      'matched', exists (
        select 1
        from public.session_activity_matches m
        join public.training_plans p
          on p.id = m.plan_id and p.user_id = v_user and p.status = 'active'
        where m.user_id = v_user and m.activity_id = a.id
      )
    ),
    a.imported_at
  from public.provider_activities a
  where a.user_id = v_user
    and a.started_at >= v_since - interval '48 hours'
    and a.imported_at >= v_since
    and a.imported_at - a.started_at < interval '48 hours'
    and a.activity_type in (
      'running', 'treadmill_running', 'track_running', 'trail_running', 'ultra_run'
    )
  on conflict (user_id, dedupe_key) do update set payload = excluded.payload
    where public.notifications.payload is distinct from excluded.payload;

  delete from public.notifications n
  where n.user_id = v_user
    and n.kind in ('garmin_activity', 'gear_mismatch')
    and not exists (
      select 1 from public.provider_activities a
      where a.user_id = v_user and a.id::text = n.payload ->> 'activityId'
    );

  select c.id, c.status, c.last_error_code, c.updated_at into v_connection
  from public.provider_connections c
  where c.user_id = v_user and c.status <> 'disconnected'
  order by c.updated_at desc
  limit 1;

  if found and v_connection.status in (
    'reconnect_required', 'expired', 'error', 'rate_limited', 'provider_unavailable'
  ) then
    insert into public.notifications (user_id, kind, dedupe_key, payload, occurred_at)
    values (
      v_user, 'garmin_connection',
      'garmin_connection:' || v_connection.id || ':' || v_connection.status,
      jsonb_build_object(
        'connectionId', v_connection.id,
        'status', v_connection.status,
        'errorCode', left(v_connection.last_error_code, 64)
      ),
      v_connection.updated_at
    )
    on conflict (user_id, dedupe_key) do update set
      payload = excluded.payload,
      occurred_at = excluded.occurred_at,
      read_at = case
        when public.notifications.resolved_at is null then public.notifications.read_at
      end,
      resolved_at = null,
      resolution = null
    where public.notifications.resolved_at is not null
      or public.notifications.payload is distinct from excluded.payload
      or public.notifications.occurred_at is distinct from excluded.occurred_at;

    update public.notifications set
      resolved_at = now(),
      resolution = 'replaced',
      read_at = coalesce(read_at, now())
    where user_id = v_user
      and kind = 'garmin_connection'
      and resolved_at is null
      and dedupe_key <> 'garmin_connection:' || v_connection.id || ':' || v_connection.status;
  elsif found and v_connection.status = 'connected' then
    update public.notifications set
      resolved_at = now(),
      resolution = 'restored',
      read_at = coalesce(read_at, now())
    where user_id = v_user and kind = 'garmin_connection' and resolved_at is null;
  end if;

  insert into public.notifications (user_id, kind, dedupe_key, payload, occurred_at)
  select
    v_user, 'watch_workout',
    'watch_workout:' || w.external_key || ':' || left(w.content_hash, 16),
    jsonb_build_object(
      'externalKey', w.external_key,
      'scheduledOn', w.scheduled_on,
      'status', w.status,
      'errorCode', left(w.error_code, 64),
      'sessionTitle', s.title
    ),
    w.updated_at
  from public.provider_workouts w
  left join lateral (
    select ps.title
    from public.plan_sessions ps
    where ps.user_id = v_user
      and ps.plan_id = case
        when split_part(w.external_key, ':', 1) ~ v_uuid
          then split_part(w.external_key, ':', 1)::uuid
      end
      and ps.session_key = substr(w.external_key, 38)
    order by ps.valid_from_version desc
    limit 1
  ) s on true
  where w.user_id = v_user
    and w.status in ('failed', 'needs_confirmation')
    and w.updated_at >= v_since
    and w.scheduled_on >= v_today
  on conflict (user_id, dedupe_key) do update set
    payload = excluded.payload,
    occurred_at = case
      when public.notifications.resolved_at is null then public.notifications.occurred_at
      else excluded.occurred_at
    end,
    read_at = case
      when public.notifications.resolved_at is null then public.notifications.read_at
    end,
    resolved_at = null,
    resolution = null
  where public.notifications.resolved_at is not null
    or public.notifications.payload is distinct from excluded.payload;

  update public.notifications n set
    resolved_at = now(),
    resolution = case
      when exists (
        select 1 from public.provider_workouts w
        where w.user_id = v_user
          and w.external_key = n.payload ->> 'externalKey'
          and w.status <> 'sent'
      ) then 'replaced'
      else 'sent'
    end,
    read_at = coalesce(n.read_at, now())
  where n.user_id = v_user
    and n.kind = 'watch_workout'
    and n.resolved_at is null
    and not exists (
      select 1 from public.provider_workouts w
      where w.user_id = v_user
        and w.status in ('failed', 'needs_confirmation')
        and w.scheduled_on >= v_today
        and n.dedupe_key = 'watch_workout:' || w.external_key || ':' || left(w.content_hash, 16)
    );

  if p_gear_mismatches is null then
    return;
  end if;

  select coalesce(jsonb_agg(g.payload), '[]') into v_gear
  from (
    select distinct on (a.id)
      jsonb_build_object(
        'activityId', a.id,
        'activityName', private.notification_excerpt(a.activity_name),
        'sessionTitle', private.notification_excerpt(item ->> 'sessionTitle'),
        'day', case when item ->> 'day' ~ '^\d{4}-\d{2}-\d{2}$' then item ->> 'day' end,
        'garmin', private.notification_excerpt(item ->> 'garmin'),
        'planned', private.notification_excerpt(item ->> 'planned')
      ) as payload
    from jsonb_array_elements(p_gear_mismatches) item
    join public.provider_activities a
      on a.user_id = v_user
      and a.id = case
        when jsonb_typeof(item) = 'object' and item ->> 'activityId' ~ v_uuid
          then (item ->> 'activityId')::uuid
      end
    order by a.id
  ) g;

  insert into public.notifications (user_id, kind, dedupe_key, payload, occurred_at)
  select v_user, 'gear_mismatch', 'gear_mismatch:' || (g ->> 'activityId'), g, now()
  from jsonb_array_elements(v_gear) g
  on conflict (user_id, dedupe_key) do update set
    payload = excluded.payload,
    occurred_at = case
      when public.notifications.resolved_at is null then public.notifications.occurred_at
      else excluded.occurred_at
    end,
    read_at = case
      when public.notifications.resolved_at is null then public.notifications.read_at
    end,
    resolved_at = null,
    resolution = null
  where public.notifications.resolved_at is not null
    or public.notifications.payload is distinct from excluded.payload;

  update public.notifications n set
    resolved_at = now(),
    resolution = 'answered',
    read_at = coalesce(n.read_at, now())
  where n.user_id = v_user
    and n.kind = 'gear_mismatch'
    and n.resolved_at is null
    and not exists (
      select 1 from jsonb_array_elements(v_gear) g
      where n.dedupe_key = 'gear_mismatch:' || (g ->> 'activityId')
    );
end;
$$;

revoke all on function private.reconcile_garmin_notifications_for(uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.reconcile_garmin_notifications(p_gear_mismatches jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  perform private.reconcile_garmin_notifications_for(v_user, p_gear_mismatches);
end;
$$;

create function private.push_json(p_text text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_text::jsonb;
exception when others then
  return null;
end;
$$;

revoke all on function private.push_json(text) from public, anon, authenticated;

create function private.push_ids(p_body jsonb, p_key text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(item), '{}')
  from jsonb_array_elements_text(
    case when jsonb_typeof(p_body -> p_key) = 'array' then p_body -> p_key else '[]' end
  ) item;
$$;

revoke all on function private.push_ids(jsonb, text) from public, anon, authenticated;

create function private.push_tick(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_user uuid;
  v_batch record;
  v_body jsonb;
  v_ids uuid[];
  v_items jsonb;
  v_request bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'push_dispatch_url' limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'push_dispatch_secret' limit 1;
  if coalesce(btrim(v_url), '') = '' or coalesce(btrim(v_secret), '') = '' then
    return;
  end if;
  if not pg_try_advisory_xact_lock(hashtext('stride-push-tick')) then
    return;
  end if;

  for v_batch in
    select d.request_id, max(d.dispatched_at) as dispatched_at,
      r.id is not null as answered, r.status_code, r.content
    from public.push_deliveries d
    left join net._http_response r on r.id = d.request_id
    where d.status = 'sent'
    group by d.request_id, r.id, r.status_code, r.content
  loop
    continue when not v_batch.answered and v_batch.dispatched_at > p_now - interval '5 minutes';
    if v_batch.status_code is not null and v_batch.status_code not between 200 and 299 then
      update public.push_deliveries set
        status = case when attempts >= 3 then 'failed' else 'pending' end,
        request_id = null
      where request_id = v_batch.request_id and status = 'sent';
      continue;
    end if;
    v_body := case
      when v_batch.status_code is not null then private.push_json(v_batch.content)
    end;
    if jsonb_typeof(v_body) = 'object' then
      delete from public.push_subscriptions s
      where s.id::text = any (private.push_ids(v_body, 'gone'))
        and s.id in (
          select d.subscription_id from public.push_deliveries d
          where d.request_id = v_batch.request_id
        );
      update public.push_deliveries set
        status = case when attempts >= 3 then 'failed' else 'pending' end,
        request_id = null
      where request_id = v_batch.request_id
        and status = 'sent'
        and id::text = any (private.push_ids(v_body, 'failed'));
    end if;
    update public.push_deliveries set status = 'delivered', request_id = null
    where request_id = v_batch.request_id and status = 'sent';
  end loop;

  for v_user in select distinct s.user_id from public.push_subscriptions s loop
    begin
      perform private.reconcile_garmin_notifications_for(v_user, null);
    exception when others then
      raise warning 'push tick could not reconcile Garmin notifications: %', sqlerrm;
    end;
  end loop;

  insert into public.push_deliveries (
    subscription_id, user_id, notification_id, dedupe_key, kind, payload, occurred_at
  )
  select
    s.id, s.user_id, n.id,
    'notification:' || n.id || ':' || extract(epoch from n.occurred_at),
    n.kind, n.payload, n.occurred_at
  from public.push_subscriptions s
  left join public.push_preferences p on p.user_id = s.user_id
  join public.notifications n on n.user_id = s.user_id
  where n.occurred_at >= greatest(p_now - interval '6 hours', s.created_at)
    and n.read_at is null
    and n.resolved_at is null
    and case
      when n.kind in ('plan_proposal', 'staff_reply', 'staff_question')
        then coalesce(p.plan_staff, true)
      when n.kind = 'garmin_activity' then coalesce(p.debrief, true)
      when n.kind in ('garmin_connection', 'watch_workout') then coalesce(p.garmin_issues, true)
      else false
    end
  on conflict (subscription_id, dedupe_key) do nothing;

  insert into public.push_deliveries (
    subscription_id, user_id, dedupe_key, kind, payload, occurred_at
  )
  select
    s.id, s.user_id,
    'session_reminder:' || t.plan_id || ':' || t.day,
    'session_reminder',
    jsonb_build_object('day', t.day, 'sessions', t.sessions),
    p_now
  from (
    select tp.id as plan_id, tp.user_id, (p_now at time zone tp.time_zone)::date as day,
      jsonb_agg(
        jsonb_build_object(
          'title', ps.title,
          'isKey', ps.is_key,
          'durationSeconds', case
            when jsonb_typeof(ps.targets -> 'durationSeconds') = 'number'
              then (ps.targets ->> 'durationSeconds')::numeric
          end
        )
        order by ps.is_key desc, ps.session_key
      ) as sessions
    from (
      select p.* from public.training_plans p
      where p.status = 'active'
        and p.time_zone in (select z.name from pg_catalog.pg_timezone_names z)
      offset 0
    ) tp
    join public.plan_sessions ps
      on ps.plan_id = tp.id
      and ps.valid_to_version is null
      and ps.scheduled_on = (p_now at time zone tp.time_zone)::date
      and ps.sport <> 'rest'
      and ps.kind <> 'rest'
    where tp.status = 'active'
      and (p_now at time zone tp.time_zone)::time >= time '07:00'
      and (p_now at time zone tp.time_zone)::time < time '12:00'
      and exists (select 1 from public.push_subscriptions x where x.user_id = tp.user_id)
      and not exists (
        select 1 from public.session_activity_matches m
        where m.plan_id = tp.id and m.session_key = ps.session_key
      )
    group by tp.id, tp.user_id, tp.time_zone
  ) t
  join public.push_subscriptions s on s.user_id = t.user_id
  left join public.push_preferences p on p.user_id = t.user_id
  where coalesce(p.session_reminder, true)
  on conflict (subscription_id, dedupe_key) do nothing;

  update public.push_deliveries d set status = 'failed'
  from (
    select d2.id
    from public.push_deliveries d2
    left join public.push_preferences p on p.user_id = d2.user_id
    left join public.notifications n on n.id = d2.notification_id
    where d2.status = 'pending'
      and (
        not case
          when d2.kind = 'session_reminder' then coalesce(p.session_reminder, true)
          when d2.kind in ('plan_proposal', 'staff_reply', 'staff_question')
            then coalesce(p.plan_staff, true)
          when d2.kind = 'garmin_activity' then coalesce(p.debrief, true)
          when d2.kind in ('garmin_connection', 'watch_workout')
            then coalesce(p.garmin_issues, true)
          else false
        end
        or (d2.notification_id is not null
          and (n.id is null or n.read_at is not null or n.resolved_at is not null))
      )
  ) stale
  where d.id = stale.id;

  select coalesce(array_agg(b.id), '{}'), coalesce(jsonb_agg(b.item), '[]')
  into v_ids, v_items
  from (
    select d.id, jsonb_build_object(
      'id', d.id,
      'subscription', jsonb_build_object(
        'id', s.id,
        'endpoint', s.endpoint,
        'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)
      ),
      'kind', d.kind,
      'payload', d.payload,
      'occurredAt', d.occurred_at,
      'faces', jsonb_build_object(
        'coach', a.coach_face,
        'medical', a.medical_face,
        'director', a.director_face,
        'strategist', a.strategist_face,
        'nutritionist', a.nutritionist_face
      )
    ) as item
    from public.push_deliveries d
    join public.push_subscriptions s on s.id = d.subscription_id
    left join public.athlete_profiles a on a.user_id = d.user_id
    where d.status = 'pending'
    order by d.occurred_at
    limit 50
    for update of d skip locked
  ) b;

  if cardinality(v_ids) > 0 then
    v_request := net.http_post(
      url := v_url,
      body := jsonb_build_object('deliveries', v_items),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      timeout_milliseconds := 60000
    );
    update public.push_deliveries set
      status = 'sent',
      request_id = v_request,
      attempts = attempts + 1,
      dispatched_at = p_now
    where id = any (v_ids);
  end if;

  delete from public.push_deliveries
  where status in ('delivered', 'failed') and created_at < p_now - interval '7 days';
end;
$$;

revoke all on function private.push_tick(timestamptz) from public, anon, authenticated;

select cron.schedule('stride-push-tick', '* * * * *', 'select private.push_tick()');
