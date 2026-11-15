# Upgrade 2: change workout type, multiple workouts a day, run tracking

## Install (in this order)
1. Supabase > SQL Editor > paste and run `supabase/migrations/003_runs_and_multi_workouts.sql`. Do this FIRST.
2. Unzip over your project folder (the inner one that contains `package.json`) and choose Replace. `.env.local` is not touched.
3. `npm run dev` and try it at http://localhost:3000.
4. Deploy: `git add .`, `git commit -m "upgrade 2"`, `git push`. Vercel redeploys on its own.
No new packages and no new environment variables.

## What is new
- **Change type**: on Today, "Change type" swaps a planned workout for another day from your split (the AI re-plans it).
  "+ Add another workout" lets you do a second session on the same day. "Train anyway" works on rest days.
- **Shift rule**: if you miss a training day, the rest of that stretch of training days moves back one day, and the next
  scheduled rest day is used to catch up (you skip the rest day, not the workout). If you miss 2 or more training days
  in a stretch, nothing shifts and you are back on your normal split. Runs never count in the split.
- **Runs**: Today > "Log a run" (miles, time, outdoor/treadmill, type, optional HR, calories, elevation, RPE, notes).
  Pace is calculated. Runs show in History (list, calendar, filter) and in a Running card on Progress.
  The AI sees recent runs and eases leg volume after long or hard runs. It never plans runs.

## Limits
- Runs are entered by hand (no Apple Health or Strava import).
- A second same-day session does not treat the first as its "previous" session.
- The nightly plan treats an untrained today as missed when working out tomorrow.
