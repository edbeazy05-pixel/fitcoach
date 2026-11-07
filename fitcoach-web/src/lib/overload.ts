export type SetLike = { weight: number; reps: number };

/** Estimated one-rep max (Epley formula). */
export const estimate1RM = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));

/** Smallest sensible jump when adding weight. */
export function increment(units: 'lb' | 'kg', isCompound: boolean) {
  if (units === 'lb') return isCompound ? 5 : 2.5;
  return isCompound ? 2.5 : 1;
}

/**
 * Double progression: fill the rep range at a weight, then add weight and drop back
 * to the bottom of the range. Returns null when there is no history yet.
 */
export function nextTarget(last: SetLike[], repMin: number, repMax: number, step: number) {
  if (last.length === 0) return null;
  const top = Math.max(...last.map((s) => s.weight));
  const working = last.filter((s) => s.weight === top);
  if (working.every((s) => s.reps >= repMax)) {
    return { weight: top + step, reps: repMin, note: 'Hit the top of the range last time: add weight' };
  }
  const fewest = Math.min(...working.map((s) => s.reps));
  return { weight: top, reps: Math.min(fewest + 1, repMax), note: 'Same weight: aim for one more rep' };
}

/** A warm-up ramp from a working weight, rounded to the nearest plate step. */
export function warmups(working: number, step = 5) {
  const round = (x: number) => Math.max(step, Math.round(x / step) * step);
  return [
    { weight: round(working * 0.4), reps: 8 },
    { weight: round(working * 0.6), reps: 5 },
    { weight: round(working * 0.8), reps: 3 },
  ];
}
