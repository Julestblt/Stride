alter table public.race_checklist_items
  add column shoe_id uuid,
  add constraint race_checklist_items_shoe_fkey foreign key (shoe_id, user_id)
    references public.athlete_shoes (id, user_id) on delete set null (shoe_id);

create index race_checklist_items_shoe_idx
  on public.race_checklist_items (shoe_id, user_id);

grant insert (shoe_id) on public.race_checklist_items to authenticated;
grant update (shoe_id) on public.race_checklist_items to authenticated;
