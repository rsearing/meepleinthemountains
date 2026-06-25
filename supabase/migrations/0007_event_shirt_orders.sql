create table public.shirt_designs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  image_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shirt_design_sizes (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.shirt_designs(id) on delete cascade,
  size_label text not null,
  price_cents integer not null check (price_cents >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  unique (design_id, size_label)
);

create table public.event_shirt_designs (
  event_id uuid not null references public.events(id) on delete cascade,
  design_id uuid not null references public.shirt_designs(id) on delete cascade,
  active boolean not null default true,
  primary key (event_id, design_id)
);

create table public.shirt_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  design_size_id uuid not null references public.shirt_design_sizes(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, profile_id, design_size_id)
);

create trigger touch_shirt_designs_updated_at before update on public.shirt_designs
for each row execute function public.touch_updated_at();
create trigger touch_shirt_orders_updated_at before update on public.shirt_orders
for each row execute function public.touch_updated_at();

alter table public.shirt_designs enable row level security;
alter table public.shirt_design_sizes enable row level security;
alter table public.event_shirt_designs enable row level security;
alter table public.shirt_orders enable row level security;

create policy "shirt designs admin all" on public.shirt_designs for all
using (public.is_admin()) with check (public.is_admin());
create policy "shirt designs assigned read" on public.shirt_designs for select
using (exists (
  select 1 from public.event_shirt_designs esd
  where esd.design_id = shirt_designs.id
    and esd.active
    and public.is_assigned_to_event(esd.event_id)
));

create policy "shirt design sizes admin all" on public.shirt_design_sizes for all
using (public.is_admin()) with check (public.is_admin());
create policy "shirt design sizes assigned read" on public.shirt_design_sizes for select
using (exists (
  select 1 from public.event_shirt_designs esd
  where esd.design_id = shirt_design_sizes.design_id
    and esd.active
    and public.is_assigned_to_event(esd.event_id)
));

create policy "event shirt designs admin all" on public.event_shirt_designs for all
using (public.is_admin()) with check (public.is_admin());
create policy "event shirt designs assigned read" on public.event_shirt_designs for select
using (public.is_assigned_to_event(event_id));

create policy "shirt orders admin all" on public.shirt_orders for all
using (public.is_admin()) with check (public.is_admin());
create policy "shirt orders household read" on public.shirt_orders for select
using (public.can_manage_profile(profile_id));
create policy "shirt orders household insert" on public.shirt_orders for insert
with check (public.can_manage_profile(profile_id) and public.is_assigned_to_event(event_id));
create policy "shirt orders household update" on public.shirt_orders for update
using (public.can_manage_profile(profile_id))
with check (public.can_manage_profile(profile_id) and public.is_assigned_to_event(event_id));
create policy "shirt orders household delete" on public.shirt_orders for delete
using (public.can_manage_profile(profile_id));

insert into storage.buckets (id, name, public)
values ('shirt-images', 'shirt-images', true)
on conflict (id) do nothing;

create policy "shirt images public read" on storage.objects for select
using (bucket_id = 'shirt-images');
create policy "shirt images admin insert" on storage.objects for insert
with check (bucket_id = 'shirt-images' and public.is_admin());
create policy "shirt images admin update" on storage.objects for update
using (bucket_id = 'shirt-images' and public.is_admin())
with check (bucket_id = 'shirt-images' and public.is_admin());
create policy "shirt images admin delete" on storage.objects for delete
using (bucket_id = 'shirt-images' and public.is_admin());
