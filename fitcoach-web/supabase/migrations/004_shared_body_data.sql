-- Upgrade 3: body weight now comes from Bodycoach (and calories from Macrocoach).
-- Run this once in the Supabase SQL Editor, AFTER Bodycoach's 001_bodycoach.sql. It is safe to run twice.

-- 1. Stop copying weigh-ins into Fitcoach's old body_metrics table (only exists if an early
--    version of the Bodycoach migration was run).
drop trigger if exists weigh_ins_to_fitcoach on public.weigh_ins;
drop function if exists public.push_weight_to_fitcoach();

-- 2. body_metrics is no longer used. Bodycoach copied everything in it (weight, body fat, waist, chest,
--    hips, arm, thigh), so it is kept only as an archive. When you have checked your history in Bodycoach,
--    you can delete it by removing the two dashes from the next line and running it:
-- drop table if exists public.body_metrics;
