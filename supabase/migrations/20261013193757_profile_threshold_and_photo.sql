alter table public.athlete_profiles
  add column threshold_heart_rate_override smallint,
  add column threshold_heart_rate_source text,
  add column profile_photo_path text,
  add constraint athlete_profile_threshold_valid check (
    (threshold_heart_rate_override is null and threshold_heart_rate_source is null)
    or (threshold_heart_rate_override is not null and threshold_heart_rate_source is not null and threshold_heart_rate_override between 100 and 230 and threshold_heart_rate_source in ('lab', 'field', 'known'))
  ),
  add constraint athlete_profile_photo_owner check (
    profile_photo_path is null or split_part(profile_photo_path, '/', 1) = user_id::text
  );

grant update (threshold_heart_rate_override, threshold_heart_rate_source, profile_photo_path)
  on public.athlete_profiles to authenticated;

grant insert (running_max_heart_rate_override, threshold_heart_rate_override, threshold_heart_rate_source, profile_photo_path)
  on public.athlete_profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy profile_images_owner_select on storage.objects for select to authenticated
using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy profile_images_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy profile_images_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
