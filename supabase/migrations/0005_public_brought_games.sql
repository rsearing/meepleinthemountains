create policy "games brought public upcoming read"
on public.games_brought for select
using (
  exists (
    select 1
    from public.events
    where events.id = games_brought.event_id
      and events.status in ('upcoming', 'active')
  )
);
