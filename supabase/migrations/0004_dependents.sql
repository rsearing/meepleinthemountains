alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists owner_profile_id uuid;

update public.profiles
set auth_user_id = id
where auth_user_id is null
  and owner_profile_id is null;

alter table public.profiles
  drop constraint if exists profiles_id_fkey,
  alter column id set default gen_random_uuid(),
  alter column email drop not null;

alter table public.profiles
  add constraint profiles_auth_user_id_key unique (auth_user_id),
  add constraint profiles_auth_user_id_fkey
    foreign key (auth_user_id) references auth.users(id) on delete cascade,
  add constraint profiles_owner_profile_id_fkey
    foreign key (owner_profile_id) references public.profiles(id) on delete cascade,
  add constraint profiles_account_type_check check (
    (
      auth_user_id is not null
      and owner_profile_id is null
    )
    or (
      role = 'attendee'
      and auth_user_id is null
      and owner_profile_id is not null
      and owner_profile_id <> id
    )
  );

create index if not exists profiles_owner_profile_idx
  on public.profiles(owner_profile_id);

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.can_manage_profile(check_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles target
    where target.id = check_profile_id
      and (
        target.auth_user_id = auth.uid()
        or target.owner_profile_id = public.current_profile_id()
      )
  );
$$;

create or replace function public.is_assigned_to_event(check_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_attendees
    where event_id = check_event_id
      and profile_id = public.current_profile_id()
  );
$$;

create or replace function public.validate_profile_relationship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_role text;
  owner_owner_id uuid;
begin
  if new.owner_profile_id is not null then
    select role, owner_profile_id
    into owner_role, owner_owner_id
    from public.profiles
    where id = new.owner_profile_id;

    if owner_role is distinct from 'attendee' or owner_owner_id is not null then
      raise exception 'A dependent must belong to a primary attendee account.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_profile_relationship_before_write on public.profiles;
create trigger validate_profile_relationship_before_write
before insert or update of owner_profile_id, auth_user_id, role on public.profiles
for each row execute function public.validate_profile_relationship();

create or replace function public.inherit_owner_events_for_dependent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_profile_id is not null then
    insert into public.event_attendees (event_id, profile_id, shirt_size_id)
    select event_id, new.id, new.shirt_size_id
    from public.event_attendees
    where profile_id = new.owner_profile_id
    on conflict (event_id, profile_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists inherit_owner_events_after_profile_insert on public.profiles;
create trigger inherit_owner_events_after_profile_insert
after insert on public.profiles
for each row execute function public.inherit_owner_events_for_dependent();

create or replace function public.sync_dependents_with_owner_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1
      from public.profiles
      where id = new.profile_id
        and owner_profile_id is null
    ) then
      insert into public.event_attendees (event_id, profile_id, shirt_size_id)
      select new.event_id, dependent.id, dependent.shirt_size_id
      from public.profiles dependent
      where dependent.owner_profile_id = new.profile_id
      on conflict (event_id, profile_id) do nothing;
    end if;
    return new;
  end if;

  if exists (
    select 1
    from public.profiles
    where id = old.profile_id
      and owner_profile_id is null
  ) then
    delete from public.event_attendees
    where event_id = old.event_id
      and profile_id in (
        select id
        from public.profiles
        where owner_profile_id = old.profile_id
      );
  end if;

  return old;
end;
$$;

drop trigger if exists sync_dependents_after_owner_event_change on public.event_attendees;
create trigger sync_dependents_after_owner_event_change
after insert or delete on public.event_attendees
for each row execute function public.sync_dependents_with_owner_event();

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self and dependents read"
on public.profiles for select
using (public.can_manage_profile(id));

drop policy if exists "event attendees self read" on public.event_attendees;
create policy "event attendees self and dependents read"
on public.event_attendees for select
using (public.can_manage_profile(profile_id));

drop policy if exists "event attendees self update preferences" on public.event_attendees;
create policy "event attendees self and dependents update preferences"
on public.event_attendees for update
using (public.can_manage_profile(profile_id))
with check (public.can_manage_profile(profile_id));

drop policy if exists "game requests owner insert" on public.game_requests;
create policy "game requests owner insert"
on public.game_requests for insert
with check (
  public.can_manage_profile(profile_id)
  and public.is_assigned_to_event(event_id)
);

drop policy if exists "game requests owner update" on public.game_requests;
create policy "game requests owner update"
on public.game_requests for update
using (public.can_manage_profile(profile_id))
with check (public.can_manage_profile(profile_id));

drop policy if exists "game requests owner delete" on public.game_requests;
create policy "game requests owner delete"
on public.game_requests for delete
using (public.can_manage_profile(profile_id) or public.is_admin());

drop policy if exists "games brought owner insert" on public.games_brought;
create policy "games brought owner insert"
on public.games_brought for insert
with check (
  public.can_manage_profile(profile_id)
  and public.is_assigned_to_event(event_id)
);

drop policy if exists "games brought owner update" on public.games_brought;
create policy "games brought owner update"
on public.games_brought for update
using (public.can_manage_profile(profile_id))
with check (public.can_manage_profile(profile_id));

drop policy if exists "games brought owner delete" on public.games_brought;
create policy "games brought owner delete"
on public.games_brought for delete
using (public.can_manage_profile(profile_id) or public.is_admin());
