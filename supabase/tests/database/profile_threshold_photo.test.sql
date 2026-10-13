begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
insert into auth.users (id, aud, role, email) values
('e0000000-0000-4000-8000-00000000000e', 'authenticated', 'authenticated', 'e@example.com'),
('f0000000-0000-4000-8000-00000000000f', 'authenticated', 'authenticated', 'f@example.com');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-4000-8000-00000000000e","role":"authenticated"}', true);
insert into public.athlete_profiles(user_id) values ('e0000000-0000-4000-8000-00000000000e');
select lives_ok($$update public.athlete_profiles set threshold_heart_rate_override=172, threshold_heart_rate_source='field', weight_kg=69 where revision=1$$, 'owner stages values in one update');
select is((select revision::int from public.athlete_profiles), 2, 'one update increments one revision');
select is((select threshold_heart_rate_source from public.athlete_profiles), 'field', 'source persists');
select throws_ok($$update public.athlete_profiles set threshold_heart_rate_source=null$$, '23514', null, 'populated threshold requires source');
select throws_ok($$update public.athlete_profiles set threshold_heart_rate_override=99$$, '23514', null, 'invalid threshold rejected');
select throws_ok($$update public.athlete_profiles set threshold_heart_rate_source='invented'$$, '23514', null, 'unknown source rejected');
update public.athlete_profiles set weight_kg=75 where revision=1;
select is((select weight_kg::numeric from public.athlete_profiles), 69::numeric, 'stale revision does not overwrite profile');
select throws_ok($$update public.athlete_profiles set profile_photo_path='f0000000-0000-4000-8000-00000000000f/photo.png'$$, '23514', null, 'photo path must belong to owner');
select lives_ok($$insert into storage.objects(bucket_id,name) values ('profile-images','e0000000-0000-4000-8000-00000000000e/photo.png')$$, 'owner may upload');
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-00000000000f","role":"authenticated"}', true);
select is((select count(*)::int from public.athlete_profiles), 0, 'other athlete cannot read profile');
select is((select count(*)::int from storage.objects where bucket_id='profile-images'), 0, 'other athlete cannot read photo');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('profile-images','e0000000-0000-4000-8000-00000000000e/other.png')$$, '42501', null, 'other athlete cannot upload to owner folder');
select lives_ok($$insert into public.athlete_profiles(user_id, first_name, running_max_heart_rate_override, threshold_heart_rate_override, threshold_heart_rate_source, profile_photo_path) values ('f0000000-0000-4000-8000-00000000000f', 'First profile', 185, 172, 'known', null)$$, 'owner may create their first profile with optional overrides');
reset role;
select * from finish();
rollback;
