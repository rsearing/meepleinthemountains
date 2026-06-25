alter table public.profiles
  add column if not exists shirt_size_id uuid references public.shirt_sizes(id) on delete set null;

update public.profiles as profile
set shirt_size_id = latest.shirt_size_id
from (
  select distinct on (profile_id)
    profile_id,
    shirt_size_id
  from public.event_attendees
  where shirt_size_id is not null
  order by profile_id, updated_at desc
) as latest
where profile.id = latest.profile_id
  and profile.shirt_size_id is null;
