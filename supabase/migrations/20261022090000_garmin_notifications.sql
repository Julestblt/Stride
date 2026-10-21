alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in (
    'plan_proposal', 'staff_reply', 'staff_question',
    'garmin_activity', 'garmin_connection', 'watch_workout', 'gear_mismatch'
  )
);

alter table public.notifications drop constraint notifications_resolution_check;
alter table public.notifications add constraint notifications_resolution_check check (
  resolution in ('applied', 'rejected', 'replaced', 'answered', 'restored', 'sent')
);

create function public.reconcile_garmin_notifications(p_gear_mismatches jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
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

revoke all on function public.reconcile_garmin_notifications(jsonb) from public, anon;
grant execute on function public.reconcile_garmin_notifications(jsonb) to authenticated;
