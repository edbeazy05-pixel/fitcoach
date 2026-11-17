'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fmtDuration, fmtPace, parseDuration, RUN_TYPES, secondsPerMile } from '@/lib/runs';
import type { Run } from '@/lib/types';
import { estimateRunCalories } from '@/lib/body';
import { RpePicker, RUN_RPE_HINT } from '@/components/RpePicker';
import { Button, Card, ErrorText, Field, Input } from '@/components/ui';

const chip = (active: boolean) =>
  `rounded-full px-3 py-1.5 text-sm font-medium ${active ? 'bg-blue-600 text-white' : 'bg-stone-100 dark:bg-stone-800'}`;

/** Parses an optional whole number. Returns undefined for blank, null for invalid. */
function optionalInt(raw: string, min: number, max: number): number | null | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export function RunForm({
  initial,
  defaultDate,
  today,
  onSaved,
}: {
  initial?: Run;
  defaultDate: string;
  today: string;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(initial?.run_date ?? defaultDate);
  const [type, setType] = useState<Run['run_type']>(initial?.run_type ?? 'easy');
  const [location, setLocation] = useState<Run['location']>(initial?.location ?? 'outdoor');
  const [distance, setDistance] = useState(initial ? String(initial.distance_mi) : '');
  const [time, setTime] = useState(initial ? fmtDuration(initial.duration_seconds) : '');
  const [hr, setHr] = useState(initial?.avg_hr ? String(initial.avg_hr) : '');
  const [calories, setCalories] = useState(initial?.calories ? String(initial.calories) : '');
  const [elevation, setElevation] = useState(initial?.elevation_ft ? String(initial.elevation_ft) : '');
  const [rpe, setRpe] = useState<number | null>(initial?.rpe ? Number(initial.rpe) : null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [weightKg, setWeightKg] = useState<number | null>(null);

  // Trend weight from Bodycoach, for the calorie estimate
  useEffect(() => {
    supabase.from('body_status').select('trend_kg').maybeSingle()
      .then(({ data }) => setWeightKg(data?.trend_kg ? Number(data.trend_kg) : null), () => {});
  }, []);

  const miles = Number(distance);
  const seconds = parseDuration(time);
  const pace = miles > 0 && seconds ? fmtPace(secondsPerMile(miles, seconds)) : null;
  const estimate = weightKg && miles > 0 && miles < 200 ? estimateRunCalories(weightKg, miles) : null;

  async function save() {
    setError('');
    if (!Number.isFinite(miles) || miles <= 0 || miles >= 200) return setError('Enter the distance in miles, for example 3.1.');
    if (!seconds) return setError('Enter the time as minutes:seconds (42:15) or hours:minutes:seconds (1:05:30).');
    const hrN = optionalInt(hr, 30, 250);
    const calN = optionalInt(calories, 0, 20000);
    const elevN = location === 'outdoor' ? optionalInt(elevation, 0, 30000) : undefined;
    if (hrN === null) return setError('Average heart rate should be a whole number between 30 and 250.');
    if (calN === null) return setError('Calories should be a whole number.');
    if (elevN === null) return setError('Elevation gain should be a whole number of feet.');

    setBusy(true);
    const payload = {
      run_date: date,
      run_type: type,
      location,
      distance_mi: Math.round(miles * 100) / 100,
      duration_seconds: seconds,
      avg_hr: hrN ?? null,
      // Left blank: save the estimate from your weight so the number is never missing
      calories: calN ?? estimate ?? null,
      elevation_ft: elevN ?? null,
      rpe,
      notes: notes.trim() || null,
    };
    const { error } = initial
      ? await supabase.from('runs').update(payload).eq('id', initial.id)
      : await supabase.from('runs').insert(payload);
    setBusy(false);
    if (error) {
      return setError(
        error.code === '42P01' ? 'The runs table is missing. Run the 003 SQL migration in Supabase first.' : error.message
      );
    }
    onSaved();
  }

  return (
    <Card className="space-y-4">
      <Field label="Date">
        <Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <div>
        <p className="mb-2 text-xs font-medium text-stone-500">Where</p>
        <div className="flex gap-2">
          <button className={chip(location === 'outdoor')} onClick={() => setLocation('outdoor')}>
            Outdoor
          </button>
          <button className={chip(location === 'treadmill')} onClick={() => setLocation('treadmill')}>
            Treadmill
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-stone-500">Type</p>
        <div className="flex flex-wrap gap-2">
          {RUN_TYPES.map((t) => (
            <button key={t.value} className={chip(type === t.value)} onClick={() => setType(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Distance (miles)">
          <Input inputMode="decimal" placeholder="3.1" value={distance} onChange={(e) => setDistance(e.target.value)} />
        </Field>
        <Field label="Time">
          <Input inputMode="numeric" placeholder="42:15" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>

      {pace && (
        <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          Pace: {pace} per mile
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Avg heart rate (optional)">
          <Input inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} />
        </Field>
        <Field label="Calories (optional)">
          <Input inputMode="numeric" value={calories} placeholder={estimate ? `≈ ${estimate}` : ''}
            onChange={(e) => setCalories(e.target.value)} />
        </Field>
        {location === 'outdoor' && (
          <Field label="Elevation gain, ft (optional)">
            <Input inputMode="numeric" value={elevation} onChange={(e) => setElevation(e.target.value)} />
          </Field>
        )}
      </div>

      {estimate && !calories.trim() && (
        <p className="-mt-2 text-xs text-stone-500">
          Left blank, calories are saved as ≈ {estimate}, estimated from your Bodycoach weight. A watch reading is more accurate.
        </p>
      )}

      <div>
        <p className="mb-2 text-xs font-medium text-stone-500">How hard did it feel? (optional)</p>
        <RpePicker value={rpe} onChange={setRpe} hints={RUN_RPE_HINT} />
      </div>

      <Field label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Weather, route, how your legs felt, treadmill incline…"
          className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base dark:border-stone-700 dark:bg-stone-950"
        />
      </Field>

      <ErrorText>{error}</ErrorText>
      <Button className="w-full" disabled={busy} onClick={save}>
        {busy ? 'Saving…' : initial ? 'Save changes' : 'Save run'}
      </Button>
    </Card>
  );
}
