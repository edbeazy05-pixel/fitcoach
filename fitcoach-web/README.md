# FitCoach: workout tracker with AI-planned sessions

A web app (Next.js + Supabase + OpenAI) that you install on your iPhone's home screen. It tracks workouts, times your rests, tracks progressive overload, and plans tomorrow's workout each night from your weekly split and recent training.

No Mac, no Expo Go, no Apple Developer account needed.

## What is included

- Email sign-in
- Profile (goal, experience, equipment, units, time zone)
- Weekly split planner (Push/Pull/Legs, Upper/Lower, Full body, Bro split)
- Exercise library (about 870 exercises, searchable by name and muscle)
- Workout logger: previous numbers beside each exercise, a target weight and reps, warm-up sets, personal-record badges, rest timer, screen stays awake
- AI workout planning for today or tomorrow (swap or regenerate)
- Nightly automatic planning and a Sunday weekly AI review
- Progress charts: estimated 1-rep max per exercise and weekly volume
- Installable on iPhone (home screen app)

## Setup (about 30 minutes)

### 1. Install the basics

Install Node.js LTS (nodejs.org) and VS Code. Open this folder in VS Code, open a terminal, and run:

```bash
npm install
```

### 2. Create the database (Supabase)

1. Create a free project at supabase.com. Save the database password.
2. Open **SQL Editor**, paste in the whole of `supabase/schema.sql`, and run it.
3. Open **Authentication, Providers, Email** and turn **off** "Confirm email" while you are testing (turn it back on later).
4. Open **Project Settings, API** and copy the project URL, the publishable key, and the secret key.

### 3. Add your keys

Copy `.env.example` to `.env.local` and fill it in:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_KEY` come from step 2.
- `SUPABASE_SECRET_KEY` is the secret key. Never share it or put it in front-end code.
- `OPENAI_API_KEY` comes from platform.openai.com. Add a small prepaid balance and set a monthly spending limit.
- `OPENAI_MODEL` defaults to `gpt-4o-mini`. Check OpenAI's pricing page; you can switch models later by changing only this value.
- `CRON_SECRET` is any long random string.

### 4. Load the exercises

```bash
node --env-file=.env.local scripts/seed-exercises.mjs
```

This downloads the free-exercise-db list from GitHub (check its license for your use) and loads it into your database. You should see "Seeded 876 exercises" or similar.

### 5. Run it on your computer

```bash
npm run dev
```

Open http://localhost:3000, create an account, then:

1. **Profile**: pick your goal and equipment, then Save.
2. **Plan**: choose a split and training days, then Save split.
3. **Today**: tap "Plan ... with AI" or "Start empty workout" and log a session.
4. After a few workouts, tap "Plan ... with AI" on Tomorrow.

### 6. Put it online and on your iPhone

1. Create a free GitHub account, make a new private repository, and push this folder to it (`git init`, `git add .`, `git commit`, `git push`). `.env.local` is already git-ignored.
2. At vercel.com sign in with GitHub, import the repository, and add the same variables from `.env.local` under Environment Variables. Deploy.
3. In Supabase, open **Authentication, URL Configuration** and set the Site URL to your Vercel address (for example `https://fitcoach-yourname.vercel.app`).
4. On your iPhone open the Vercel address in **Safari**, tap Share, then **Add to Home Screen**. It now opens full-screen like an app.

### 7. Check the nightly jobs

`vercel.json` schedules two jobs (times are UTC):

- `0 1 * * *`: plans tomorrow's workout (7 pm Central in winter, 8 pm in summer)
- `0 2 * * 1`: writes the weekly review (Sunday evening Central)

Vercel's free plan limits how often and how precisely cron jobs run, so check Vercel's current cron limits. To test a job by hand, in a terminal run:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-SITE.vercel.app/api/cron/nightly
```

You should get back JSON such as `{"<your-user-id>":"planned"}`.

## How it fits together

| Part | Where |
| --- | --- |
| Screens | `src/app/(app)/` (Today, Plan, History, Progress, Profile, workout/[id]) |
| Sign-in | `src/app/login/page.tsx` |
| AI planning and review (server only) | `src/lib/server/ai.ts` |
| API routes | `src/app/api/suggest`, `review`, `cron/nightly`, `cron/weekly` |
| Weight progression math | `src/lib/overload.ts` |
| Split templates | `src/lib/splitTemplates.ts` |
| Database | `supabase/schema.sql` |

The AI only picks exercises from a list your code supplies and returns JSON that is validated before saving. If its answer is unusable, a rule-based workout is saved instead. Weights are never invented by the AI; they come from `nextTarget` in `overload.ts` (double progression: fill the rep range, then add weight).

## Limits to know about

- No haptic buzz, and no push notifications. The rest timer beeps only while the app is open on screen. A reminder can be added later with web push (iOS supports it only for home-screen apps) or email.
- This is not an App Store app.
- A free Supabase project pauses after a week of inactivity. If the app errors after a quiet week, restore it from the Supabase dashboard.
- Dates and time zones: the nightly job plans for "tomorrow" in the time zone saved on your Profile.

## Status

This code compiles, passes lint, builds for production, and its progression and date math is tested. It has not been run against a live Supabase project or OpenAI account, so expect to fix small things on first use. If something fails, copy the exact error message when asking for help.
