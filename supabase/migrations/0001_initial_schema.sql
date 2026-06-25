create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  role text not null default 'attendee' check (role in ('admin', 'attendee')),
  phone text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  location text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'upcoming', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.event_images (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.shirt_sizes (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_beds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  bed_type text,
  capacity integer not null default 1 check (capacity > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, name)
);

create table public.event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  shirt_size_id uuid references public.shirt_sizes(id) on delete set null,
  food_allergies text,
  food_preferences text,
  bed_id uuid references public.event_beds(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

create table public.game_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.games_brought (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_attendees_event_idx on public.event_attendees(event_id);
create index event_attendees_profile_idx on public.event_attendees(profile_id);
create index event_beds_event_idx on public.event_beds(event_id);
create index game_requests_event_idx on public.game_requests(event_id);
create index games_brought_event_idx on public.games_brought(event_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
create trigger touch_events_updated_at before update on public.events for each row execute function public.touch_updated_at();
create trigger touch_shirt_sizes_updated_at before update on public.shirt_sizes for each row execute function public.touch_updated_at();
create trigger touch_event_beds_updated_at before update on public.event_beds for each row execute function public.touch_updated_at();
create trigger touch_event_attendees_updated_at before update on public.event_attendees for each row execute function public.touch_updated_at();
create trigger touch_game_requests_updated_at before update on public.game_requests for each row execute function public.touch_updated_at();
create trigger touch_games_brought_updated_at before update on public.games_brought for each row execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_assigned_to_event(check_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_attendees
    where event_id = check_event_id
      and profile_id = auth.uid()
  );
$$;

create or replace function public.bed_has_capacity(check_bed_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_beds b
    where b.id = check_bed_id
      and (
        select count(*)
        from public.event_attendees ea
        where ea.bed_id = check_bed_id
      ) < b.capacity
  );
$$;

create or replace function public.enforce_event_attendee_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bed_capacity integer;
  assigned_count integer;
begin
  if new.bed_id is not null then
    select capacity
    into bed_capacity
    from public.event_beds
    where id = new.bed_id
      and event_id = new.event_id;

    if bed_capacity is null then
      raise exception 'Selected bed does not belong to this event.';
    end if;

    select count(*)
    into assigned_count
    from public.event_attendees
    where bed_id = new.bed_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if assigned_count >= bed_capacity then
      raise exception 'Selected bed is already at capacity.';
    end if;
  end if;

  if tg_op = 'UPDATE' and not public.is_admin() then
    if new.event_id <> old.event_id
      or new.profile_id <> old.profile_id
      or new.bed_id is distinct from old.bed_id then
      raise exception 'Attendees can only update their own preferences.';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_event_attendee_rules_before_write
before insert or update on public.event_attendees
for each row execute function public.enforce_event_attendee_rules();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_images enable row level security;
alter table public.shirt_sizes enable row level security;
alter table public.event_beds enable row level security;
alter table public.event_attendees enable row level security;
alter table public.game_requests enable row level security;
alter table public.games_brought enable row level security;

create policy "profiles admin all" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "profiles self read" on public.profiles for select using (id = auth.uid());

create policy "events public upcoming read" on public.events for select using (status in ('upcoming', 'active'));
create policy "events assigned read" on public.events for select using (public.is_assigned_to_event(id));
create policy "events admin all" on public.events for all using (public.is_admin()) with check (public.is_admin());

create policy "event images public read" on public.event_images for select using (
  exists (
    select 1 from public.events e
    where e.id = event_id and e.status in ('upcoming', 'active')
  )
);
create policy "event images assigned read" on public.event_images for select using (public.is_assigned_to_event(event_id));
create policy "event images admin all" on public.event_images for all using (public.is_admin()) with check (public.is_admin());

create policy "shirt sizes authenticated read" on public.shirt_sizes for select to authenticated using (active = true or public.is_admin());
create policy "shirt sizes admin all" on public.shirt_sizes for all using (public.is_admin()) with check (public.is_admin());

create policy "event beds public aggregate read" on public.event_beds for select using (
  exists (
    select 1 from public.events e
    where e.id = event_id and e.status in ('upcoming', 'active')
  )
);
create policy "event beds assigned read" on public.event_beds for select using (public.is_assigned_to_event(event_id));
create policy "event beds admin all" on public.event_beds for all using (public.is_admin()) with check (public.is_admin());

create policy "event attendees admin all" on public.event_attendees for all using (public.is_admin()) with check (public.is_admin());
create policy "event attendees self read" on public.event_attendees for select using (profile_id = auth.uid());
create policy "event attendees self update preferences" on public.event_attendees for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "game requests event read" on public.game_requests for select using (public.is_assigned_to_event(event_id) or public.is_admin());
create policy "game requests owner insert" on public.game_requests for insert with check (profile_id = auth.uid() and public.is_assigned_to_event(event_id));
create policy "game requests owner update" on public.game_requests for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "game requests owner delete" on public.game_requests for delete using (profile_id = auth.uid() or public.is_admin());
create policy "game requests admin all" on public.game_requests for all using (public.is_admin()) with check (public.is_admin());

create policy "games brought event read" on public.games_brought for select using (public.is_assigned_to_event(event_id) or public.is_admin());
create policy "games brought owner insert" on public.games_brought for insert with check (profile_id = auth.uid() and public.is_assigned_to_event(event_id));
create policy "games brought owner update" on public.games_brought for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "games brought owner delete" on public.games_brought for delete using (profile_id = auth.uid() or public.is_admin());
create policy "games brought admin all" on public.games_brought for all using (public.is_admin()) with check (public.is_admin());

insert into public.shirt_sizes (label, sort_order) values
  ('S', 10),
  ('M', 20),
  ('L', 30),
  ('XL', 40),
  ('XXL', 50),
  ('XXXL', 60)
on conflict (label) do nothing;

insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

create policy "event images bucket public read"
on storage.objects for select
using (bucket_id = 'event-images');

create policy "event images bucket admin insert"
on storage.objects for insert
with check (bucket_id = 'event-images' and public.is_admin());

create policy "event images bucket admin update"
on storage.objects for update
using (bucket_id = 'event-images' and public.is_admin())
with check (bucket_id = 'event-images' and public.is_admin());

create policy "event images bucket admin delete"
on storage.objects for delete
using (bucket_id = 'event-images' and public.is_admin());
