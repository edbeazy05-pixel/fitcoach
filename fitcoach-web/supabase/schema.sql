-- Run this whole file once in the Supabase SQL Editor.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  goal text check (goal in ('strength','size','fat_loss','general')),
  experience text check (experience in ('beginner','intermediate','advanced')),
  units text not null default 'lb' check (units in ('lb','kg')),
  equipment text[] not null default '{}',
  session_minutes int not null default 60,
  timezone text not null default 'America/Chicago',
  created_at timestamptz not null default now()
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text not null,
  is_compound boolean not null default false,
  instructions text,
  user_id uuid references auth.users(id)   -- null = built-in, set = your own custom exercise
);

create table splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  is_active boolean not null default true
);

create table split_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  split_id uuid not null references splits(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),   -- 0 = Sunday
  label text not null,
  target_muscles text[] not null default '{}'
);

create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_date date not null,
  label text,
  status text not null default 'planned' check (status in ('planned','in_progress','done','skipped')),
  source text not null default 'manual' check (source in ('manual','ai')),
  started_at timestamptz,
  finished_at timestamptz,
  notes text,
  ai_rationale text
);

create unique index one_ai_workout_per_day on workouts (user_id, workout_date) where source = 'ai';

create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  position int not null,
  target_sets int,
  target_reps_min int,
  target_reps_max int
);

create table sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
  set_number int not null,
  weight numeric not null,
  reps int not null,
  rpe numeric,
  is_warmup boolean not null default false,
  completed_at timestamptz not null default now()
);

create table ai_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  summary text not null,
  stats jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- Finished working sets only; the app and the AI routes both read this
create view exercise_history with (security_invoker = true) as
select s.user_id, we.exercise_id, w.workout_date, s.set_number, s.weight, s.reps, s.rpe
from sets s
join workout_exercises we on we.id = s.workout_exercise_id
join workouts w on w.id = we.workout_id
where w.status = 'done' and not s.is_warmup;

-- Row-level security: every query is limited to the signed-in user's own rows
do $$
declare t text;
begin
  foreach t in array array['splits','split_days','workouts','workout_exercises','sets','ai_reviews'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own_rows on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table profiles enable row level security;
create policy own_profile on profiles for all using (id = auth.uid()) with check (id = auth.uid());

alter table exercises enable row level security;
create policy read_exercises on exercises for select using (user_id is null or user_id = auth.uid());
create policy add_own_exercises on exercises for insert with check (user_id = auth.uid());
