-- 1. Create Tables

-- User profiles
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  equipment text[] default '{}',
  goal text,
  onboarding_complete boolean default false,
  current_week integer default 1,
  created_at timestamptz default now()
);

-- Workout plans
create table workout_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  week_number integer not null,
  days jsonb not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Ghost sessions (battle results per exercise)
create table ghost_sessions (
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
create table exercise_cache (
  exercise_name text primary key,
  gif_url text,
  youtube_video_id text,
  instructions jsonb,
  body_part text,
  cached_at timestamptz default now()
);

-- 2. Enable Row Level Security
alter table profiles enable row level security;
alter table workout_plans enable row level security;
alter table ghost_sessions enable row level security;
alter table exercise_cache enable row level security;

-- 3. RLS Policies

-- Profiles
create policy "Users: own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Workout plans
create policy "Users: own plans" on workout_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ghost sessions
create policy "Users: own sessions" on ghost_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Exercise cache — public read, authenticated write
create policy "Cache: public read" on exercise_cache
  for select using (true);
create policy "Cache: auth write" on exercise_cache
  for insert with check (auth.role() = 'authenticated');
create policy "Cache: auth update" on exercise_cache
  for update using (auth.role() = 'authenticated');

-- 4. Avatar Storage Bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict do nothing;

create policy "Avatars: own upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Avatars: own read" on storage.objects
  for select using (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

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
