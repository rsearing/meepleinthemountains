create table public.shirt_design_images (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.shirt_designs(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index shirt_design_images_design_idx
  on public.shirt_design_images(design_id);

insert into public.shirt_design_images (design_id, storage_path, sort_order)
select id, image_path, 0
from public.shirt_designs
where image_path is not null
  and not exists (
    select 1
    from public.shirt_design_images image
    where image.design_id = shirt_designs.id
      and image.storage_path = shirt_designs.image_path
  );

alter table public.shirt_design_images enable row level security;

create policy "shirt design images admin all"
on public.shirt_design_images for all
using (public.is_admin())
with check (public.is_admin());

create policy "shirt design images assigned read"
on public.shirt_design_images for select
using (
  exists (
    select 1
    from public.event_shirt_designs event_design
    where event_design.design_id = shirt_design_images.design_id
      and event_design.active
      and public.is_assigned_to_event(event_design.event_id)
  )
);
