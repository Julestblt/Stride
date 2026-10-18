alter table public.athlete_profiles
  add column director_face text not null default 'marc'
    check (director_face in ('marc', 'sophie')),
  add column strategist_face text not null default 'hugo'
    check (strategist_face in ('hugo', 'nadia')),
  add column nutritionist_face text not null default 'lea'
    check (nutritionist_face in ('lea', 'yanis'));

grant update (director_face, strategist_face, nutritionist_face)
  on public.athlete_profiles to authenticated;
