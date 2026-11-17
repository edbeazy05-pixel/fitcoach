// Body and nutrition context from Bodycoach and Macrocoach, turned into training guidance.
// Pure functions only: used by the browser (Progress, run form) and the server (AI plan and review).

export const KG_PER_LB = 0.45359237;
const KCAL_PER_KG = 7700;

export type Units = 'lb' | 'kg';
export const kgTo = (kg: number, units: Units) => (units === 'lb' ? kg / KG_PER_LB : kg);

/** Rough running energy cost: about 1 kcal per kg of body weight per km, on flat ground or a treadmill. */
export const estimateRunCalories = (weightKg: number, miles: number) => Math.round(weightKg * miles * 1.609344);

/** Weekly change in kg: slope of a straight line through the weigh-ins of the last `days` days (same rule as Macrocoach). */
export function weeklyChangeKg(points: { date: string; kg: number }[], endDate: string, days = 21) {
  const day = (s: string) => Math.round(Date.parse(`${s}T12:00:00Z`) / 86400000);
  const end = day(endDate);
  const pts = points.map((p) => ({ x: day(p.date), y: p.kg })).filter((p) => p.x <= end && p.x > end - days);
  if (pts.length < 4) return null;
  const xs = pts.map((p) => p.x);
  if (Math.max(...xs) - Math.min(...xs) < 7) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const sxy = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  return (sxy / sxx) * 7;
}

export type BodyInputs = {
  endDate: string;
  weights: { date: string; kg: number; trend: number }[]; // body_weight_daily, oldest first, ~5 weeks
  bodyFatPct: number | null;
  leanKg: number | null;
  goal: 'cut' | 'maintain' | 'bulk' | null; // Macrocoach goal
  goalRatePct: number | null;
  targetKcal: number | null;
  targetProteinG: number | null;
  intake: { date: string; kcal: number; protein: number }[]; // Macrocoach daily totals, last 7 full days
};

export type Energy = 'deficit' | 'maintenance' | 'surplus' | 'unknown';

export type BodyContext = {
  trend_kg: number | null;
  weekly_change_kg: number | null;
  weekly_change_pct: number | null; // % of body weight per week, negative = losing
  change_7d_kg: number | null;
  change_28d_kg: number | null;
  body_fat_pct: number | null;
  lean_kg: number | null;
  goal: BodyInputs['goal'];
  target_kcal: number | null;
  avg_kcal_7d: number | null;
  days_logged_7d: number;
  avg_protein_g_7d: number | null;
  target_protein_g: number | null;
  protein_g_per_kg: number | null;
  energy: Energy;
  aggressive_deficit: boolean;
  low_protein: boolean;
  guidance: string[];
};

const r = (x: number | null, p = 1) => (x == null ? null : Math.round(x * 10 ** p) / 10 ** p);

export function buildBodyContext(i: BodyInputs): BodyContext {
  const w = [...i.weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = w[w.length - 1] ?? null;
  const trendKg = latest?.trend ?? null;
  const trendOnOrBefore = (date: string) => [...w].reverse().find((p) => p.date <= date)?.trend ?? null;
  const back = (n: number) => {
    const d = new Date(`${i.endDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const t7 = trendOnOrBefore(back(7));
  const t28 = trendOnOrBefore(back(28));

  const weekly = weeklyChangeKg(w.map((p) => ({ date: p.date, kg: p.kg })), i.endDate, 21);
  const weeklyPct = weekly != null && trendKg ? (weekly / trendKg) * 100 : null;

  // A day with under 800 kcal logged is treated as "not really logged" (same rule as Macrocoach)
  const logged = i.intake.filter((d) => d.kcal >= 800);
  const avgKcal = logged.length ? logged.reduce((s, d) => s + d.kcal, 0) / logged.length : null;
  const avgProtein = logged.length ? logged.reduce((s, d) => s + d.protein, 0) / logged.length : null;
  const proteinPerKg = avgProtein != null && trendKg ? avgProtein / trendKg : null;

  // What the scale says beats what the plan says; the Macrocoach goal is the fallback
  let energy: Energy = 'unknown';
  if (weeklyPct != null) energy = weeklyPct <= -0.25 ? 'deficit' : weeklyPct >= 0.25 ? 'surplus' : 'maintenance';
  else if (i.goal) energy = i.goal === 'cut' ? 'deficit' : i.goal === 'bulk' ? 'surplus' : 'maintenance';

  const eatingFarUnder = avgKcal != null && logged.length >= 4 && i.targetKcal != null && avgKcal < i.targetKcal * 0.85;
  const aggressive = energy === 'deficit' && ((weeklyPct != null && weeklyPct <= -1) || eatingFarUnder);
  const lowProtein = proteinPerKg != null && logged.length >= 4 && proteinPerKg < 1.6;

  const guidance: string[] = [];
  if (energy === 'deficit') {
    guidance.push('Calorie deficit: keep loads heavy on the main compound lifts so strength (and muscle) is held; do not chase rep or weight PRs; if anything is trimmed, trim accessory sets, never the load on compounds.');
  } else if (energy === 'surplus') {
    guidance.push('Calorie surplus: recovery is good, so push progressive overload and add a set to lagging muscles where useful.');
  } else if (energy === 'maintenance') {
    guidance.push('Weight is stable: normal progression.');
  }
  if (aggressive) {
    guidance.push('Aggressive deficit (losing over 1% of body weight a week, or eating well under target): recovery is reduced. At most 3 sets per exercise and keep total volume moderate.');
  }
  if (lowProtein) {
    guidance.push(`Protein is low (${r(proteinPerKg)} g per kg of body weight against about 1.6 to 2.2 recommended), which limits muscle repair.`);
  }

  return {
    trend_kg: r(trendKg, 2),
    weekly_change_kg: r(weekly, 2),
    weekly_change_pct: r(weeklyPct, 2),
    change_7d_kg: trendKg != null && t7 != null ? r(trendKg - t7, 2) : null,
    change_28d_kg: trendKg != null && t28 != null ? r(trendKg - t28, 2) : null,
    body_fat_pct: i.bodyFatPct,
    lean_kg: i.leanKg,
    goal: i.goal,
    target_kcal: i.targetKcal,
    avg_kcal_7d: r(avgKcal, 0),
    days_logged_7d: logged.length,
    avg_protein_g_7d: r(avgProtein, 0),
    target_protein_g: i.targetProteinG,
    protein_g_per_kg: r(proteinPerKg),
    energy,
    aggressive_deficit: aggressive,
    low_protein: lowProtein,
    guidance,
  };
}

/** The same context with weights in the user's units, for the AI prompt and the screen. */
export function forDisplay(c: BodyContext, units: Units) {
  const u = (kg: number | null, p = 1) => (kg == null ? null : r(kgTo(kg, units), p));
  return {
    unit: units,
    trend_weight: u(c.trend_kg),
    weekly_change: u(c.weekly_change_kg, 2),
    weekly_change_pct_of_bodyweight: c.weekly_change_pct,
    change_last_7_days: u(c.change_7d_kg, 2),
    change_last_28_days: u(c.change_28d_kg, 2),
    body_fat_pct: c.body_fat_pct,
    lean_mass: u(c.lean_kg),
    nutrition_goal: c.goal,
    target_kcal: c.target_kcal,
    avg_kcal_last_7_days: c.avg_kcal_7d,
    days_food_logged_last_7: c.days_logged_7d,
    avg_protein_g_last_7_days: c.avg_protein_g_7d,
    protein_g_per_kg: c.protein_g_per_kg,
    energy_balance: c.energy,
    aggressive_deficit: c.aggressive_deficit,
    guidance: c.guidance,
  };
}

export const hasBodyData = (c: BodyContext) => c.trend_kg != null || c.target_kcal != null || c.days_logged_7d > 0;

/** Implied daily energy balance from the weight trend (negative = deficit). */
export const impliedDailyBalance = (weeklyChangeKg: number | null) =>
  weeklyChangeKg == null ? null : Math.round((weeklyChangeKg * KCAL_PER_KG) / 7);
