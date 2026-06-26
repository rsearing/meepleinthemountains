create or replace function public.get_public_brought_games()
returns table (
  id uuid,
  event_id uuid,
  title text
)
language sql
security definer
set search_path = public
as $$
  select
    gb.id,
    gb.event_id,
    gb.title
  from public.games_brought gb
  join public.events e
    on e.id = gb.event_id
  where e.status in ('upcoming', 'active')
    and exists (
      select 1
      from public.event_attendees ea
      where ea.event_id = gb.event_id
        and ea.profile_id = gb.profile_id
    )
  order by gb.title;
$$;

revoke all on function public.get_public_brought_games() from public;
grant execute on function public.get_public_brought_games() to anon, authenticated;
