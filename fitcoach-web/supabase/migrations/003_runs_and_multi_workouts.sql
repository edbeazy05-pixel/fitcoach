-- Upgrade 2: several workouts per day, and run tracking.
-- Run this whole file once in the Supabase SQL Editor (choose "Run and enable RLS" if asked).
-- It is safe to run twice.

-- 1. Allow more than one AI-planned workout on the same day (one per workout type per day).
--    Before this, the database allowed only one AI-planned workout per day.
drop index if exists one_ai_workout_per_day;
create unique index if not exists one_ai_workout_per_label_per_day
  on workouts (user_id, workout_date, label) where source = 'ai';

-- 2. Runs (distance is always in miles)
create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  run_date date not null,
  run_type text not null default 'easy'
    check (run_type in ('easy','long','tempo','intervals','race','other')),
  location text not null default 'outdoor' check (location in ('outdoor','treadmill')),
  distance_mi numeric not null check (distance_mi > 0 and distance_mi < 200),
  duration_seconds int not null check (duration_seconds > 0),
  avg_hr int check (avg_hr between 30 and 250),
  calories int check (calories >= 0),
  elevation_ft int check (elevation_ft >= 0),
  rpe numeric check (rpe between 1 and 10),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists runs_user_date on runs (user_id, run_date desc);

alter table runs enable row level security;
drop policy if exists own_rows on runs;
create policy own_rows on runs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
