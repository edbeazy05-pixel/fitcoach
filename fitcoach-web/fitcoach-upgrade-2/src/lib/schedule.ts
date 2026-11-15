import { addDays, weekdayOf } from './dates';

export type SplitDayLite = { weekday: number; label: string; target_muscles: string[] };
/** A lifting workout you actually started or finished (not one that is only planned). */
export type TrainedDay = { date: string; label: string | null };

export type Effective = {
  /** What to train on this date, or null on a rest day. */
  day: SplitDayLite | null;
  /** What the split says for this weekday, ignoring any shifting. Null on a scheduled rest day. */
  original: SplitDayLite | null;
  reason: 'original' | 'shifted' | 'reset' | 'rest';
  /** Scheduled training days earlier in this stretch with no workout. */
  missed: string[];
};

/**
 * Works out what to train on a date, given your split and what you have actually done.
 *
 * - A "stretch" is a run of scheduled training days, bounded by scheduled rest days.
 * - Workouts you have already done in the stretch are crossed off the stretch's list of types, so a
 *   missed workout is still waiting and everything after it moves back a day.
 * - The shift ends at the next scheduled rest day, and that rest day is used to catch up: it takes
 *   the last workout that was pushed back. The rest day is skipped, not the workout.
 *   The next stretch then starts fresh on your normal split.
 * - If two or more scheduled training days in the stretch had no workout, nothing shifts and the
 *   rest day stays a rest day: you are back on your original split.
 * - Days before your first ever workout are never counted as missed.
 */
export function effectiveDay(
  date: string,
  split: SplitDayLite[],
  trained: TrainedDay[],
  earliest: string | null
): Effective {
  const byDay = new Map(split.map((d) => [d.weekday, d]));
  const original = byDay.get(weekdayOf(date)) ?? null;

  if (!original) return restDay(date, byDay, trained, earliest);
  if (!earliest || earliest >= date) return { day: original, original, reason: 'original', missed: [] };

  // Walk back to the start of this stretch (at most 6 days, never before your first workout)
  let start = date;
  for (let i = 0; i < 6; i++) {
    const prev = addDays(start, -1);
    if (!byDay.has(weekdayOf(prev)) || prev < earliest) break;
    start = prev;
  }
  // Walk forward to the end of this stretch
  let end = date;
  for (let i = 0; i < 6; i++) {
    const next = addDays(end, 1);
    if (!byDay.has(weekdayOf(next))) break;
    end = next;
  }

  const queue: SplitDayLite[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) queue.push(byDay.get(weekdayOf(d))!);

  const before = trained.filter((t) => t.date >= start && t.date < date).sort((a, b) => a.date.localeCompare(b.date));
  const trainedDates = new Set(before.map((t) => t.date));
  const missed: string[] = [];
  for (let d = start; d < date; d = addDays(d, 1)) if (!trainedDates.has(d)) missed.push(d);

  if (missed.length >= 2) return { day: original, original, reason: 'reset', missed };

  const remaining = crossOff(queue, before);
  const day = remaining[0] ?? original;
  return { day, original, reason: day.label === original.label ? 'original' : 'shifted', missed };
}

/** Cross off what you have done, matching each workout to the first matching type still waiting. */
function crossOff(queue: SplitDayLite[], done: TrainedDay[]) {
  const remaining = [...queue];
  for (const t of done) {
    if (!t.label) continue;
    const i = remaining.findIndex((q) => q.label === t.label);
    if (i >= 0) remaining.splice(i, 1);
  }
  return remaining;
}

/**
 * A scheduled rest day. It stays a rest day, unless it is the first rest day after a stretch in which
 * exactly one training day was missed: then it takes the workout that is still owed.
 */
function restDay(
  date: string,
  byDay: Map<number, SplitDayLite>,
  trained: TrainedDay[],
  earliest: string | null
): Effective {
  const rest: Effective = { day: null, original: null, reason: 'rest', missed: [] };
  const last = addDays(date, -1);
  // Only the first rest day after a stretch can absorb a workout
  if (!earliest || !byDay.has(weekdayOf(last)) || last < earliest) return rest;

  let start = last;
  for (let i = 0; i < 5; i++) {
    const prev = addDays(start, -1);
    if (!byDay.has(weekdayOf(prev)) || prev < earliest) break;
    start = prev;
  }

  const queue: SplitDayLite[] = [];
  for (let d = start; d <= last; d = addDays(d, 1)) queue.push(byDay.get(weekdayOf(d))!);

  const before = trained.filter((t) => t.date >= start && t.date < date).sort((a, b) => a.date.localeCompare(b.date));
  const trainedDates = new Set(before.map((t) => t.date));
  const missed: string[] = [];
  for (let d = start; d <= last; d = addDays(d, 1)) if (!trainedDates.has(d)) missed.push(d);

  if (missed.length !== 1) return { ...rest, missed };
  const remaining = crossOff(queue, before);
  if (remaining.length === 0) return { ...rest, missed };
  return { day: remaining[0], original: null, reason: 'shifted', missed };
}
