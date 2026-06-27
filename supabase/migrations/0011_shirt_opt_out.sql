alter table public.event_attendees
  add column if not exists shirt_opted_out boolean not null default false,
  add column if not exists shirt_choice_updated_at timestamptz;

comment on column public.event_attendees.shirt_opted_out is
  'True when the attendee explicitly declined to purchase a shirt for this event.';

comment on column public.event_attendees.shirt_choice_updated_at is
  'The most recent time the attendee submitted an order or explicit shirt opt-out.';
