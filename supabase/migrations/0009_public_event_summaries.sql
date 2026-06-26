create or replace function public.get_public_event_summaries()
returns table (
  event_id uuid,
  attendee_count bigint,
  available_beds bigint,
  total_bed_slots bigint
)
language sql
security definer
set search_path = public
as $$
  select
    e.id as event_id,
    (
      select count(*)
      from public.event_attendees ea
      where ea.event_id = e.id
    ) as attendee_count,
    (
      select coalesce(
        sum(
          case
            when exists (
              select 1
              from public.event_attendees occupied
              where occupied.bed_id = eb.id
            )
            then 0
            else eb.capacity
          end
        ),
        0
      )::bigint
      from public.event_beds eb
      where eb.event_id = e.id
    ) as available_beds,
    (
      select coalesce(sum(eb.capacity), 0)::bigint
      from public.event_beds eb
      where eb.event_id = e.id
    ) as total_bed_slots
  from public.events e
  where e.status in ('upcoming', 'active')
$$;

revoke all on function public.get_public_event_summaries() from public;
grant execute on function public.get_public_event_summaries() to anon, authenticated;
