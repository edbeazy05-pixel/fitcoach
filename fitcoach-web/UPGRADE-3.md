# Upgrade 3: body weight and nutrition from Bodycoach and Macrocoach

## Install (in this order)
1. Bodycoach's `supabase/migrations/001_bodycoach.sql` must already be run (it copied your Fitcoach body log over).
2. Supabase > SQL Editor > paste and run `supabase/migrations/004_shared_body_data.sql`.
3. Delete `src/components/BodyMetrics.tsx` (the old weight form; nothing uses it any more).
   Optional, same time: delete the `BodyMetric` type at the bottom of `src/lib/types.ts`.
4. Optional: add `NEXT_PUBLIC_BODYCOACH_URL` and `NEXT_PUBLIC_MACROCOACH_URL` in Vercel (and `.env.local`) for the
   buttons on Progress.
5. `npm run dev` to try it, then `git add .`, `git commit -m "upgrade 3"`, `git push`. No new packages.

## What is new
- **No more weight form.** Log weight, measurements and body fat in Bodycoach. Fitcoach reads them.
- **Plans react to your body and food.** Each AI workout plan sees your trend weight, how fast it is changing, body fat,
  and Macrocoach's calories and protein for the last 7 days. It works out whether you are cutting, maintaining or gaining
  from the scale trend (Macrocoach's goal is the fallback):
  - Cutting: main lifts stay heavy to hold strength; extra sets are trimmed before load is.
  - Cutting hard (losing over 1% of body weight a week, or eating under 85% of your calorie target): every exercise is
    capped at 3 sets. This is enforced in code, not left to the AI.
  - Gaining: plans push progression.
- **Weekly review** now connects training to your weight trend, calories and protein (for example, strength holding
  during a cut is called out as a win, and low protein is flagged).
- **Progress** has a "Body and nutrition" card that shows what the plans are reacting to, and the 1-rep-max chart shows
  strength relative to body weight (for example 1.21× body weight).
- **Runs**: leave calories blank and an estimate from your weight is saved (about 1 kcal per kg per km).

## Files
- `src/lib/body.ts` the rules (pure functions, tested in `tests/body.test.ts`: `npx tsx --test tests/body.test.ts`)
- `src/lib/bodyData.ts` reads `body_weight_daily`, `body_status`, `nutrition_profiles`, `food_entries`
- `src/components/BodySummary.tsx`, `src/lib/useBody.ts` the Progress card
- Changed: `src/lib/server/ai.ts`, `src/app/(app)/progress/page.tsx`, `src/components/RunForm.tsx`, `.env.example`

## Limits
- If Bodycoach or Macrocoach has no data, Fitcoach plans exactly as before.
- The old `body_metrics` table is kept as an archive; `004_shared_body_data.sql` shows how to delete it.
