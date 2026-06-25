delete from public.game_requests as request
where not exists (
  select 1
  from public.event_attendees as attendee
  where attendee.event_id = request.event_id
    and attendee.profile_id = request.profile_id
);

delete from public.games_brought as brought
where not exists (
  select 1
  from public.event_attendees as attendee
  where attendee.event_id = brought.event_id
    and attendee.profile_id = brought.profile_id
);

create or replace function public.delete_removed_attendee_games()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.game_requests
  where event_id = old.event_id
    and profile_id = old.profile_id;

  delete from public.games_brought
  where event_id = old.event_id
    and profile_id = old.profile_id;

  return old;
end;
$$;

drop trigger if exists delete_removed_attendee_games_after_delete
on public.event_attendees;

create trigger delete_removed_attendee_games_after_delete
after delete on public.event_attendees
for each row execute function public.delete_removed_attendee_games();

drop policy if exists "games brought public upcoming read"
on public.games_brought;

create policy "games brought public upcoming read"
on public.games_brought for select
using (
  exists (
    select 1
    from public.events
    where events.id = games_brought.event_id
      and events.status in ('upcoming', 'active')
  )
  and exists (
    select 1
    from public.event_attendees
    where event_attendees.event_id = games_brought.event_id
      and event_attendees.profile_id = games_brought.profile_id
  )
);
