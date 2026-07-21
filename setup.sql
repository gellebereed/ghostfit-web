-- ═════════════════════════════════════════════════════════════════════════════
-- GhostFit — full database setup (idempotent: safe to run repeatedly)
-- Every table uses IF NOT EXISTS, every policy is dropped before creation,
-- every column addition uses IF NOT EXISTS. Run the whole file in the
-- Supabase SQL editor whenever the schema changes.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Core Tables

create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  equipment text[] default '{}',
  goal text,
  onboarding_complete boolean default false,
  current_week integer default 1,
  created_at timestamptz default now()
);

create table if not exists workout_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  week_number integer not null,
  days jsonb not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists ghost_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  exercise_name text not null,
  date timestamptz default now(),
  total_reps integer default 0,
  avg_weight float default 0,
  total_duration integer default 0,
  sets_completed integer default 0,
  result text check (result in ('win', 'loss', 'incomplete')),
  character_tier integer default 1
);

-- Exercise cache — shared across all users
create table if not exists exercise_cache (
  exercise_name text primary key,
  gif_url text,
  youtube_video_id text,
  instructions jsonb,
  body_part text,
  cached_at timestamptz default now()
);

-- Landing page signups (email capture / waitlist)
create table if not exists landing_signups (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  source text default 'landing_page',
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security
alter table profiles enable row level security;
alter table workout_plans enable row level security;
alter table ghost_sessions enable row level security;
alter table exercise_cache enable row level security;
alter table landing_signups enable row level security;

-- 3. Core RLS Policies

drop policy if exists "Users: own profile" on profiles;
create policy "Users: own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users: own plans" on workout_plans;
create policy "Users: own plans" on workout_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users: own sessions" on ghost_sessions;
create policy "Users: own sessions" on ghost_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Cache: public read" on exercise_cache;
create policy "Cache: public read" on exercise_cache
  for select using (true);
drop policy if exists "Cache: auth write" on exercise_cache;
create policy "Cache: auth write" on exercise_cache
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "Cache: auth update" on exercise_cache;
create policy "Cache: auth update" on exercise_cache
  for update using (auth.role() = 'authenticated');

drop policy if exists "Landing signups: public insert" on landing_signups;
create policy "Landing signups: public insert" on landing_signups
  for insert with check (true);

-- 4. Avatar Storage Bucket

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict do nothing;

drop policy if exists "Avatars: own upload" on storage.objects;
create policy "Avatars: own upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Avatars: own read" on storage.objects;
create policy "Avatars: own read" on storage.objects
  for select using (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Avatars: own update" on storage.objects;
create policy "Avatars: own update" on storage.objects
  for update using (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 5. Auto-create Profile on Sign Up

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. RPG Economy Layer

alter table profiles add column if not exists soul_coins integer default 0;
alter table profiles add column if not exists unlocked_cosmetics text[] default '{}';
alter table profiles add column if not exists equipped_cosmetics jsonb default '{}';
alter table profiles add column if not exists weight_kg float default 75;
alter table profiles add column if not exists current_streak integer default 0;
alter table profiles add column if not exists character_style text default 'warrior';
alter table profiles add column if not exists aura_color text default '#00FF87';
alter table profiles add column if not exists character_name text default 'YOU';
alter table profiles add column if not exists ghost_style text default 'warrior';
alter table profiles add column if not exists ghost_aura_color text default '#FFFFFF';
alter table profiles add column if not exists ghost_name text default 'GHOST';
alter table profiles add column if not exists uses_custom_avatar boolean default false;
alter table profiles add column if not exists custom_avatar_data_url text;
alter table profiles add column if not exists uses_custom_ghost boolean default false;
alter table profiles add column if not exists custom_ghost_data_url text;

create or replace function add_soul_coins(user_id uuid, amount integer)
returns void language sql as $$
  update profiles set soul_coins = greatest(0, soul_coins + amount) where id = user_id;
$$;

-- 7. Social Layer: friends & challenges

alter table profiles add column if not exists friend_code text unique;

-- Short shareable code, unambiguous alphabet (no 0/O/1/I)
create or replace function public.ensure_friend_code()
returns text language plpgsql security definer as $$
declare
  code text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  select friend_code into code from profiles where id = auth.uid();
  if code is not null then return code; end if;
  loop
    code := (
      select string_agg(substr(chars, (floor(random() * 32) + 1)::int, 1), '')
      from generate_series(1, 6)
    );
    begin
      update profiles set friend_code = code where id = auth.uid();
      return code;
    exception when unique_violation then
      -- collision, retry
    end;
  end loop;
end;
$$;

-- Look up a user by code without exposing the profiles table
create or replace function public.find_by_friend_code(code text)
returns table (user_id uuid, character_name text, character_style text, aura_color text)
language sql security definer as $$
  select id, character_name, character_style, aura_color
  from profiles
  where friend_code = upper(trim(code)) and id <> auth.uid();
$$;

create table if not exists friendships (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

-- One friendship per pair regardless of direction
create unique index if not exists friendships_pair_idx
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table if not exists challenges (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid not null references profiles(id) on delete cascade,
  opponent_id uuid references profiles(id) on delete cascade, -- null = shadow challenge vs your own best week
  metric text not null default 'total_reps' check (metric in ('total_reps', 'sets', 'workouts')),
  duration_days integer not null default 7 check (duration_days between 1 and 30),
  wager_coins integer not null default 0 check (wager_coins >= 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'completed')),
  starts_at timestamptz,
  ends_at timestamptz,
  shadow_baseline float default 0,
  winner_id uuid references profiles(id),
  creator_settled boolean default false,
  opponent_settled boolean default false,
  created_at timestamptz default now()
);

alter table friendships enable row level security;
alter table challenges enable row level security;

drop policy if exists "Friendships: participants read" on friendships;
create policy "Friendships: participants read" on friendships
  for select using (auth.uid() in (requester_id, addressee_id));
drop policy if exists "Friendships: requester sends" on friendships;
create policy "Friendships: requester sends" on friendships
  for insert with check (auth.uid() = requester_id and status = 'pending');
drop policy if exists "Friendships: addressee responds" on friendships;
create policy "Friendships: addressee responds" on friendships
  for update using (auth.uid() = addressee_id);
drop policy if exists "Friendships: either party removes" on friendships;
create policy "Friendships: either party removes" on friendships
  for delete using (auth.uid() in (requester_id, addressee_id));

drop policy if exists "Challenges: participants read" on challenges;
create policy "Challenges: participants read" on challenges
  for select using (auth.uid() in (creator_id, opponent_id) or (opponent_id is null and auth.uid() = creator_id));
drop policy if exists "Challenges: creator makes" on challenges;
create policy "Challenges: creator makes" on challenges
  for insert with check (auth.uid() = creator_id);
drop policy if exists "Challenges: participants update" on challenges;
create policy "Challenges: participants update" on challenges
  for update using (auth.uid() in (creator_id, opponent_id) or (opponent_id is null and auth.uid() = creator_id));

-- Friends (or pending requesters) can read each other's basic profile
drop policy if exists "Profiles: connections read" on profiles;
create policy "Profiles: connections read" on profiles
  for select using (
    exists (
      select 1 from friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = profiles.id)
         or (f.addressee_id = auth.uid() and f.requester_id = profiles.id)
    )
  );

-- Accepted friends can read each other's sessions (powers challenge scores & friend ghosts)
drop policy if exists "Sessions: friends read" on ghost_sessions;
create policy "Sessions: friends read" on ghost_sessions
  for select using (
    exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = ghost_sessions.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = ghost_sessions.user_id))
    )
  );

-- 8. Psychology Engine

alter table profiles add column if not exists streak_shields integer default 0;
alter table profiles add column if not exists shielded_dates text[] default '{}';
alter table profiles add column if not exists commitment_time text;

-- 9. Nutritionist Layer

-- Shared per-country food catalog (same pattern as exercise_cache)
create table if not exists food_catalogs (
  country_code text primary key,
  country_name text,
  foods jsonb not null,
  cached_at timestamptz default now()
);

create table if not exists nutrition_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  country_code text,
  country_name text,
  sex text check (sex in ('male', 'female')),
  age integer,
  height_cm float,
  activity_level text default 'moderate',
  restrictions text[] default '{}',
  meals_per_day integer default 3,
  foods_liked jsonb default '[]',
  foods_to_try jsonb default '[]',
  foods_excluded jsonb default '[]',
  custom_foods jsonb default '[]',
  target_kcal integer,
  target_protein integer,
  target_carbs integer,
  target_fat integer,
  onboarding_complete boolean default false,
  last_checkin_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists meal_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  week_number integer not null default 1,
  days jsonb not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Consolidated shopping list for the plan: { hash, categories: [...] }
alter table meal_plans add column if not exists grocery_list jsonb;

create table if not exists meal_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  log_date date not null default current_date,
  meal_index integer not null,
  status text not null check (status in ('ate', 'skipped')),
  kcal integer default 0,
  protein integer default 0,
  carbs integer default 0,
  fat integer default 0,
  created_at timestamptz default now(),
  unique (user_id, log_date, meal_index)
);

alter table food_catalogs enable row level security;
alter table nutrition_profiles enable row level security;
alter table meal_plans enable row level security;
alter table meal_logs enable row level security;

drop policy if exists "Food catalogs: public read" on food_catalogs;
create policy "Food catalogs: public read" on food_catalogs
  for select using (true);
drop policy if exists "Food catalogs: auth insert" on food_catalogs;
create policy "Food catalogs: auth insert" on food_catalogs
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "Food catalogs: auth update" on food_catalogs;
create policy "Food catalogs: auth update" on food_catalogs
  for update using (auth.role() = 'authenticated');

drop policy if exists "Nutrition profiles: own" on nutrition_profiles;
create policy "Nutrition profiles: own" on nutrition_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Meal plans: own" on meal_plans;
create policy "Meal plans: own" on meal_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Meal logs: own" on meal_logs;
create policy "Meal logs: own" on meal_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 10. Quests Layer (goals & tasks — mirrors the user's Notion Workshop system)

create table if not exists quests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references quests(id) on delete set null,
  title text not null,
  why text,
  quest_type text not null default 'monthly' check (quest_type in ('north_star', 'quarterly', 'monthly')),
  status text not null default 'active' check (status in ('active', 'done', 'killed')),
  target_date date,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists quest_tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  quest_id uuid references quests(id) on delete cascade, -- null = inbox task
  title text not null,
  note text,
  priority integer not null default 2 check (priority between 1 and 3),
  do_date date,
  is_done boolean default false,
  done_at timestamptz,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table quests enable row level security;
alter table quest_tasks enable row level security;

drop policy if exists "Quests: own" on quests;
create policy "Quests: own" on quests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Quest tasks: own" on quest_tasks;
create policy "Quest tasks: own" on quest_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 11. Daily Rhythm (habits — deen & body daily practices) + recipe cache

create table if not exists habits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  emoji text default '✨',
  category text not null default 'body' check (category in ('deen', 'body', 'mind')),
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists habit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  log_date date not null default current_date,
  created_at timestamptz default now(),
  unique (habit_id, log_date)
);

-- Shared recipe cache (same pattern as exercise_cache / food_catalogs)
create table if not exists meal_recipes (
  recipe_key text primary key,   -- slug of meal title + items hash
  title text,
  recipe jsonb not null,         -- { ingredients: string[], steps: string[], tip: string }
  cached_at timestamptz default now()
);

alter table habits enable row level security;
alter table habit_logs enable row level security;
alter table meal_recipes enable row level security;

drop policy if exists "Habits: own" on habits;
create policy "Habits: own" on habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Habit logs: own" on habit_logs;
create policy "Habit logs: own" on habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Recipes: public read" on meal_recipes;
create policy "Recipes: public read" on meal_recipes
  for select using (true);
drop policy if exists "Recipes: auth insert" on meal_recipes;
create policy "Recipes: auth insert" on meal_recipes
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "Recipes: auth update" on meal_recipes;
create policy "Recipes: auth update" on meal_recipes
  for update using (auth.role() = 'authenticated');
