export const RUN_TYPES: { value: 'easy' | 'long' | 'tempo' | 'intervals' | 'race' | 'other'; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'long', label: 'Long' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'intervals', label: 'Intervals' },
  { value: 'race', label: 'Race' },
  { value: 'other', label: 'Other' },
];

export const runTypeLabel = (value: string) => RUN_TYPES.find((t) => t.value === value)?.label ?? value;

/**
 * Turns "42:15" (minutes:seconds), "1:05:30" (hours:minutes:seconds) or "45" (minutes) into seconds.
 * Returns null if it is not a valid time.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim();
  if (!text) return null;
  const parts = text.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d{1,3}$/.test(p))) return null;
  const nums = parts.map(Number);
  let seconds: number;
  if (nums.length === 1) {
    seconds = nums[0] * 60; // a plain number means minutes
  } else if (nums.length === 2) {
    if (nums[1] > 59) return null;
    seconds = nums[0] * 60 + nums[1];
  } else {
    if (nums[1] > 59 || nums[2] > 59) return null;
    seconds = nums[0] * 3600 + nums[1] * 60 + nums[2];
  }
  return seconds > 0 ? seconds : null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 2535 -> "42:15", 3930 -> "1:05:30" */
export function fmtDuration(totalSeconds: number) {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${m}:${pad2(s % 60)}`;
}

/** Seconds per mile for a run. */
export const secondsPerMile = (miles: number, seconds: number) => seconds / miles;

/** 522 -> "8:42" (seconds per mile, rounded to the second) */
export function fmtPace(secPerMile: number) {
  const s = Math.round(secPerMile);
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

export const roundTo = (n: number, places = 1) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
