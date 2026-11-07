# Upgrade 1

New: swap exercises, how-to instructions, workout notes, session RPE, repeat a past workout,
calendar view, custom exercises, body weight and measurement charts.

## Install (in this order)

1. Supabase: open SQL Editor, paste all of `supabase/migrations/002_upgrades.sql`, and run it
   (choose "Run and enable RLS" if asked). Do this BEFORE deploying the new code.
2. Unzip this file into your project folder (the one containing package.json) and choose
   "Replace" when asked. Your .env.local is not touched.
3. Test on your computer: `npm run dev`
4. Deploy: `git add .`, `git commit -m "Upgrade 1"`, `git push`. Vercel redeploys automatically.

No new packages to install and no new environment variables.
