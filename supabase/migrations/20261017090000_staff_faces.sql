alter table public.athlete_profiles
  add column coach_face text not null default 'claire'
    check (coach_face in ('claire', 'thomas')),
  add column medical_face text not null default 'ines'
    check (medical_face in ('ines', 'karim'));

grant update (coach_face, medical_face) on public.athlete_profiles to authenticated;
