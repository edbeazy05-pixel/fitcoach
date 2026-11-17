import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays } from './dates';
import { buildBodyContext, type BodyContext } from './body';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Reads Bodycoach and Macrocoach data for one person. Works with the browser client (row level security)
// and with the server's admin client (which sees everyone, so every query filters by user id).
// Any missing table or failed query just leaves that part empty.
export async function loadBodyContext(db: SupabaseClient, userId: string, endDate: string): Promise<BodyContext> {
  const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> => {
    try {
      const { data, error } = await p;
      return error ? null : data;
    } catch {
      return null;
    }
  };

  const [weights, status, nutrition, food] = await Promise.all([
    safe<any[]>(
      db.from('body_weight_daily').select('weigh_date, weight_kg, trend_kg')
        .eq('user_id', userId).gte('weigh_date', addDays(endDate, -35)).lte('weigh_date', endDate)
        .order('weigh_date')
    ),
    safe<any>(
      db.from('body_status').select('body_fat_pct, lean_mass_kg').eq('user_id', userId).maybeSingle()
    ),
    safe<any>(
      db.from('nutrition_profiles').select('goal, weekly_rate_pct, target_kcal, target_protein_g').eq('id', userId).maybeSingle()
    ),
    // The last 7 full days (today is still being eaten)
    safe<any[]>(
      db.from('food_entries').select('entry_date, kcal, protein_g')
        .eq('user_id', userId).gte('entry_date', addDays(endDate, -7)).lt('entry_date', endDate)
        .limit(2000)
    ),
  ]);

  const byDay = new Map<string, { kcal: number; protein: number }>();
  for (const f of food ?? []) {
    const d = byDay.get(f.entry_date) ?? { kcal: 0, protein: 0 };
    d.kcal += Number(f.kcal) || 0;
    d.protein += Number(f.protein_g) || 0;
    byDay.set(f.entry_date, d);
  }
  const num = (v: unknown) => (v == null ? null : Number(v));

  return buildBodyContext({
    endDate,
    weights: (weights ?? []).map((w) => ({ date: w.weigh_date, kg: Number(w.weight_kg), trend: Number(w.trend_kg) })),
    bodyFatPct: num(status?.body_fat_pct),
    leanKg: num(status?.lean_mass_kg),
    goal: nutrition?.goal ?? null,
    goalRatePct: num(nutrition?.weekly_rate_pct),
    targetKcal: num(nutrition?.target_kcal),
    targetProteinG: num(nutrition?.target_protein_g),
    intake: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
  });
}
