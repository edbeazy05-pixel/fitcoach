'use client';

import { hasBodyData, impliedDailyBalance, kgTo, type BodyContext, type Units } from '@/lib/body';
import { Card } from '@/components/ui';

const BODYCOACH_URL = process.env.NEXT_PUBLIC_BODYCOACH_URL;
const MACROCOACH_URL = process.env.NEXT_PUBLIC_MACROCOACH_URL;

const ENERGY_TEXT: Record<BodyContext['energy'], { label: string; tone: string; effect: string }> = {
  deficit: {
    label: 'Cutting',
    tone: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    effect: 'Plans keep your main lifts heavy to hold strength, and trim extra sets before they cut weight.',
  },
  surplus: {
    label: 'Gaining',
    tone: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200',
    effect: 'Recovery is good, so plans push progression and may add a set to lagging muscles.',
  },
  maintenance: {
    label: 'Maintaining',
    tone: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
    effect: 'Weight is steady, so plans use normal progression.',
  },
  unknown: {
    label: 'No data yet',
    tone: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
    effect: 'Log your weight in Bodycoach and plans will adjust to whether you are cutting or gaining.',
  },
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-stone-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

export function BodySummary({ ctx, units }: { ctx: BodyContext | null; units: Units }) {
  if (!ctx) return null;
  const w = (kg: number | null, digits = 1) => (kg == null ? '—' : `${kgTo(kg, units).toFixed(digits)} ${units}`);
  const signed = (kg: number | null, digits = 1) =>
    kg == null ? '—' : `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${w(Math.abs(kg), digits)}`;
  const e = ENERGY_TEXT[ctx.energy];
  const balance = impliedDailyBalance(ctx.weekly_change_kg);

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Body and nutrition</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${e.tone}`}>{e.label}</span>
      </div>

      {hasBodyData(ctx) && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Trend weight" value={w(ctx.trend_kg)}
            sub={ctx.weekly_change_kg != null ? `${signed(ctx.weekly_change_kg, 2)}/week` : undefined} />
          <Stat label="Body fat" value={ctx.body_fat_pct != null ? `${ctx.body_fat_pct}%` : '—'}
            sub={ctx.lean_kg != null ? `${w(ctx.lean_kg)} lean` : undefined} />
          <Stat label="Calories, 7 days" value={ctx.avg_kcal_7d != null ? String(ctx.avg_kcal_7d) : '—'}
            sub={ctx.target_kcal ? `target ${ctx.target_kcal}` : ctx.days_logged_7d ? undefined : 'not logged'} />
        </div>
      )}

      <p className="text-sm">{e.effect}</p>
      {ctx.weekly_change_pct != null && balance != null && (
        <p className="text-xs text-stone-500">
          Changing {Math.abs(ctx.weekly_change_pct).toFixed(2)}% of body weight a week, which is roughly a{' '}
          {Math.abs(balance)} kcal daily {balance < 0 ? 'deficit' : 'surplus'}.
        </p>
      )}
      {ctx.aggressive_deficit && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          You are cutting hard, so plans are capped at 3 sets per exercise to protect recovery.
        </p>
      )}
      {ctx.low_protein && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Protein is averaging {ctx.avg_protein_g_7d} g ({ctx.protein_g_per_kg} g/kg). About 1.6 to 2.2 g/kg helps you keep and build muscle.
        </p>
      )}

      {(BODYCOACH_URL || MACROCOACH_URL) && (
        <div className="flex gap-2">
          {BODYCOACH_URL && (
            <a href={BODYCOACH_URL} className="flex-1 rounded-xl bg-stone-100 px-3 py-2 text-center text-sm font-semibold dark:bg-stone-800">
              Log weight in Bodycoach
            </a>
          )}
          {MACROCOACH_URL && (
            <a href={MACROCOACH_URL} className="flex-1 rounded-xl bg-stone-100 px-3 py-2 text-center text-sm font-semibold dark:bg-stone-800">
              Open Macrocoach
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
