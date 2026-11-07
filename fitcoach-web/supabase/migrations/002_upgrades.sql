-- Upgrade 1: session effort, body metrics, custom exercise management.
-- Run this whole file once in the Supabase SQL Editor (choose "Run and enable RLS" if asked).
-- It is safe to run twice.

-- 1. Overall effort rating for a workout (1 = very easy, 10 = max effort)
alter table workouts
  add column if not exists session_rpe numeric check (session_rpe between 1 and 10);

-- 2. Body weight and measurements, one row per person per day
create table if not exists body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_on date not null,
  weight numeric,       -- in your profile units (lb or kg)
  body_fat numeric,     -- percent
  waist numeric,        -- inches if you use lb, cm if you use kg
  chest numeric,
  hips numeric,
  arm numeric,
  thigh numeric,
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

alter table body_metrics enable row level security;
drop policy if exists own_rows on body_metrics;
create policy own_rows on body_metrics
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Let people delete their own custom exercises (built-in ones, where user_id is null, stay protected)
drop policy if exists delete_own_exercises on exercises;
create policy delete_own_exercises on exercises
  for delete using (user_id = auth.uid());
