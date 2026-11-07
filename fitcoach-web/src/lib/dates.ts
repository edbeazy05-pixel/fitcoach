const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD for a Date in the device's local time (never toISOString, which is UTC). */
export const toLocalDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Add days to a YYYY-MM-DD string. */
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, for a YYYY-MM-DD string. */
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Today's YYYY-MM-DD in a given IANA time zone (falls back to UTC if the zone is invalid). */
export function todayIn(timeZone: string, now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000);

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function prettyDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
