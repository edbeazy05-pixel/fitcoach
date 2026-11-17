// Run with: npx tsx --test tests/body.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBodyContext, estimateRunCalories, forDisplay, impliedDailyBalance, type BodyInputs } from '../src/lib/body';

const days = (n: number, start = '2026-10-20') =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${start}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

const base: BodyInputs = {
  endDate: '2026-11-17', weights: [], bodyFatPct: null, leanKg: null, goal: null, goalRatePct: null,
  targetKcal: null, targetProteinG: null, intake: [],
};
const series = (perDay: number) =>
  days(29).map((date, i) => ({ date, kg: 90 + perDay * i, trend: 90 + perDay * i }));

test('steady loss of about 0.5% a week is a normal deficit', () => {
  const c = buildBodyContext({ ...base, weights: series(-0.065), goal: 'cut', targetKcal: 2200 });
  assert.equal(c.energy, 'deficit');
  assert.equal(c.aggressive_deficit, false);
  assert.ok(Math.abs(c.weekly_change_kg! - -0.455) < 0.01);
  assert.ok(c.guidance[0].startsWith('Calorie deficit'));
});

test('losing over 1% a week is aggressive', () => {
  const c = buildBodyContext({ ...base, weights: series(-0.15) });
  assert.equal(c.energy, 'deficit');
  assert.equal(c.aggressive_deficit, true);
});

test('eating far under target on a cut is aggressive even if the scale lags', () => {
  const intake = days(7, '2026-11-10').map((date) => ({ date, kcal: 1600, protein: 190 }));
  const c = buildBodyContext({ ...base, weights: series(-0.05), targetKcal: 2200, intake });
  assert.equal(c.aggressive_deficit, true);
  assert.equal(c.avg_kcal_7d, 1600);
  assert.equal(c.low_protein, false);
});

test('surplus, maintenance, low protein and the Macrocoach goal fallback', () => {
  assert.equal(buildBodyContext({ ...base, weights: series(0.06) }).energy, 'surplus');
  assert.equal(buildBodyContext({ ...base, weights: series(0.001) }).energy, 'maintenance');
  assert.equal(buildBodyContext({ ...base, goal: 'bulk' }).energy, 'surplus');
  assert.equal(buildBodyContext(base).energy, 'unknown');
  const intake = days(5, '2026-11-12').map((date) => ({ date, kcal: 2000, protein: 100 }));
  const low = buildBodyContext({ ...base, weights: series(0), intake });
  assert.equal(low.low_protein, true); // 100 g at 90 kg = 1.1 g/kg
  // days with under 800 kcal logged are ignored
  const partial = buildBodyContext({ ...base, intake: [{ date: '2026-11-16', kcal: 300, protein: 20 }] });
  assert.equal(partial.days_logged_7d, 0);
});

test('display units, energy balance and run calories', () => {
  const c = buildBodyContext({ ...base, weights: series(-0.065) });
  const d = forDisplay(c, 'lb');
  assert.ok(Math.abs(d.trend_weight! - (90 - 0.065 * 28) / 0.45359237) < 0.1);
  assert.equal(impliedDailyBalance(-0.5), -550);
  assert.equal(estimateRunCalories(80, 3.1), 399);
});
