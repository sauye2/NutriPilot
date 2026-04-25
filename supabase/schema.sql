create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  calories integer not null default 2200,
  protein numeric(8,1) not null default 150,
  carbs numeric(8,1) not null default 220,
  fat numeric(8,1) not null default 70,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  cuisine text,
  summary text,
  source text not null check (source in ('manual', 'generated', 'imported')),
  calories integer not null default 0,
  protein numeric(8,1) not null default 0,
  carbs numeric(8,1) not null default 0,
  fat numeric(8,1) not null default 0,
  instructions jsonb not null default '[]'::jsonb,
  why_it_works jsonb not null default '[]'::jsonb,
  grocery_list jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.meal_ingredients (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(10,2) not null default 0,
  unit text not null,
  notes text,
  fdc_id bigint,
  food_description text,
  food_data_type text,
  source_label text,
  calories integer not null default 0,
  protein numeric(8,1) not null default 0,
  carbs numeric(8,1) not null default 0,
  fat numeric(8,1) not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.imported_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_url text not null,
  image_url text,
  ingredients jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id uuid references public.meals(id) on delete set null,
  log_date date not null default current_date,
  title text not null,
  calories integer not null default 0,
  protein numeric(8,1) not null default 0,
  carbs numeric(8,1) not null default 0,
  fat numeric(8,1) not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_meals_user_created_at
  on public.meals (user_id, created_at desc);

create index if not exists idx_meal_ingredients_meal_id
  on public.meal_ingredients (meal_id);

create index if not exists idx_meal_ingredients_user_id
  on public.meal_ingredients (user_id);

create index if not exists idx_imported_recipes_user_created_at
  on public.imported_recipes (user_id, created_at desc);

create index if not exists idx_daily_logs_user_log_date
  on public.daily_logs (user_id, log_date desc);

drop trigger if exists set_nutrition_goals_updated_at on public.nutrition_goals;
create trigger set_nutrition_goals_updated_at
before update on public.nutrition_goals
for each row execute procedure public.set_updated_at();

drop trigger if exists set_meals_updated_at on public.meals;
create trigger set_meals_updated_at
before update on public.meals
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.nutrition_goals enable row level security;
alter table public.meals enable row level security;
alter table public.meal_ingredients enable row level security;
alter table public.imported_recipes enable row level security;
alter table public.daily_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "nutrition_goals_select_own" on public.nutrition_goals;
create policy "nutrition_goals_select_own"
on public.nutrition_goals for select
using (user_id = auth.uid());

drop policy if exists "nutrition_goals_insert_own" on public.nutrition_goals;
create policy "nutrition_goals_insert_own"
on public.nutrition_goals for insert
with check (user_id = auth.uid());

drop policy if exists "nutrition_goals_update_own" on public.nutrition_goals;
create policy "nutrition_goals_update_own"
on public.nutrition_goals for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "nutrition_goals_delete_own" on public.nutrition_goals;
create policy "nutrition_goals_delete_own"
on public.nutrition_goals for delete
using (user_id = auth.uid());

drop policy if exists "meals_select_own" on public.meals;
create policy "meals_select_own"
on public.meals for select
using (user_id = auth.uid());

drop policy if exists "meals_insert_own" on public.meals;
create policy "meals_insert_own"
on public.meals for insert
with check (user_id = auth.uid());

drop policy if exists "meals_update_own" on public.meals;
create policy "meals_update_own"
on public.meals for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "meals_delete_own" on public.meals;
create policy "meals_delete_own"
on public.meals for delete
using (user_id = auth.uid());

drop policy if exists "meal_ingredients_select_own" on public.meal_ingredients;
create policy "meal_ingredients_select_own"
on public.meal_ingredients for select
using (user_id = auth.uid());

drop policy if exists "meal_ingredients_insert_own" on public.meal_ingredients;
create policy "meal_ingredients_insert_own"
on public.meal_ingredients for insert
with check (user_id = auth.uid());

drop policy if exists "meal_ingredients_update_own" on public.meal_ingredients;
create policy "meal_ingredients_update_own"
on public.meal_ingredients for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "meal_ingredients_delete_own" on public.meal_ingredients;
create policy "meal_ingredients_delete_own"
on public.meal_ingredients for delete
using (user_id = auth.uid());

drop policy if exists "imported_recipes_select_own" on public.imported_recipes;
create policy "imported_recipes_select_own"
on public.imported_recipes for select
using (user_id = auth.uid());

drop policy if exists "imported_recipes_insert_own" on public.imported_recipes;
create policy "imported_recipes_insert_own"
on public.imported_recipes for insert
with check (user_id = auth.uid());

drop policy if exists "imported_recipes_update_own" on public.imported_recipes;
create policy "imported_recipes_update_own"
on public.imported_recipes for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "imported_recipes_delete_own" on public.imported_recipes;
create policy "imported_recipes_delete_own"
on public.imported_recipes for delete
using (user_id = auth.uid());

drop policy if exists "daily_logs_select_own" on public.daily_logs;
create policy "daily_logs_select_own"
on public.daily_logs for select
using (user_id = auth.uid());

drop policy if exists "daily_logs_insert_own" on public.daily_logs;
create policy "daily_logs_insert_own"
on public.daily_logs for insert
with check (user_id = auth.uid());

drop policy if exists "daily_logs_update_own" on public.daily_logs;
create policy "daily_logs_update_own"
on public.daily_logs for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "daily_logs_delete_own" on public.daily_logs;
create policy "daily_logs_delete_own"
on public.daily_logs for delete
using (user_id = auth.uid());
