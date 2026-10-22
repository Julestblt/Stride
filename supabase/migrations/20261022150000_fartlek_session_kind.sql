alter table public.plan_sessions
  drop constraint plan_sessions_kind_check;

alter table public.plan_sessions
  add constraint plan_sessions_kind_check
    check (
      kind in (
        'easy', 'long', 'recovery', 'tempo', 'threshold', 'intervals', 'hills',
        'fartlek', 'race_specific', 'race', 'strength', 'mobility', 'cross', 'rest'
      )
    );
