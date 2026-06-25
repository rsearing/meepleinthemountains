alter table public.profiles
  add column if not exists allergies text[] not null default '{}',
  add column if not exists drink_preferences text[] not null default '{}',
  add column if not exists snack_preferences text[] not null default '{}',
  add column if not exists food_preferences text[] not null default '{}',
  add column if not exists comments text;
