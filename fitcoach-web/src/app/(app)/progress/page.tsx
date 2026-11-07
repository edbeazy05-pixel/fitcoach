'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/api';
import { addDays, todayIn, weekdayOf } from '@/lib/dates';
import { estimate1RM } from '@/lib/overload';
import type { HistoryRow } from '@/lib/types';
import { Button, Card, ErrorText, PageTitle } from '@/components/ui';

type Review = { week_start: string; summary: string };

const mondayOf = (date: string) => addDays(date, -((weekdayOf(date) + 6) % 7));

export default function ProgressPage() {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  async function loadReview() {
    const { data } = await supabase
      .from('ai_reviews')
      .select('week_start, summary')
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    setReview((data as Review | null) ?? null);
  }

  useEffect(() => {
    (async () => {
      setMounted(true);
      const { data: p } = await supabase.from('profiles').select('timezone').maybeSingle();
      const zone = p?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTz(zone);

      const { data: h } = await supabase
        .from('exercise_history')
        .select('exercise_id, workout_date, set_number, weight, reps')
        .gte('workout_date', addDays(todayIn(zone), -180))
        .limit(5000);
      const rows = ((h ?? []) as HistoryRow[]).map((r) => ({ ...r, weight: Number(r.weight) }));
      setHistory(rows);

      const ids = Array.from(new Set(rows.map((r) => r.exercise_id)));
      if (ids.length) {
        const { data: ex } = await supabase.from('exercises').select('id, name').in('id', ids);
        setNames(Object.fromEntries((ex ?? []).map((e) => [e.id, e.name])));
        // Default to the exercise trained on the most days
        const days: Record<string, Set<string>> = {};
        for (const r of rows) (days[r.exercise_id] ??= new Set()).add(r.workout_date);
        setSelected(Object.entries(days).sort((a, b) => b[1].size - a[1].size)[0][0]);
      }
      loadReview();
    })();
  }, []);

  const strengthData = useMemo(() => {
    const best: Record<string, number> = {};
    for (const r of history) {
      if (r.exercise_id !== selected) continue;
      best[r.workout_date] = Math.max(best[r.workout_date] ?? 0, estimate1RM(r.weight, r.reps));
    }
    return Object.entries(best)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: date.slice(5), e1rm: Math.round(v) }));
  }, [history, selected]);

  const volumeData = useMemo(() => {
    const thisMonday = mondayOf(todayIn(tz));
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisMonday, -7 * (7 - i)));
    const totals: Record<string, number> = Object.fromEntries(weeks.map((w) => [w, 0]));
    for (const r of history) {
      const wk = mondayOf(r.workout_date);
      if (wk in totals) totals[wk] += r.weight * r.reps;
    }
    return weeks.map((w) => ({ week: w.slice(5), volume: Math.round(totals[w]) }));
  }, [history, tz]);

  async function generate() {
    setBusy(true);
    setError('');
    try {
      await authedPost('/api/review', { week_end: todayIn(tz) });
      await loadReview();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the review');
    }
    setBusy(false);
  }

  const exerciseOptions = Object.entries(names).sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <div className="space-y-4">
      <PageTitle>Progress</PageTitle>

      <Card className="space-y-3">
        <h2 className="font-semibold">Weekly review</h2>
        {review ? (
          <>
            <p className="whitespace-pre-line text-sm">{review.summary}</p>
            <p className="text-xs text-stone-500">Week starting {review.week_start}</p>
          </>
        ) : (
          <p className="text-sm text-stone-500">No review yet. One is written every Sunday evening, or you can make one now.</p>
        )}
        <ErrorText>{error}</ErrorText>
        <Button variant="ghost" disabled={busy} onClick={generate}>
          {busy ? 'Writing…' : 'Review the last 7 days'}
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Estimated 1-rep max</h2>
        {exerciseOptions.length === 0 ? (
          <p className="text-sm text-stone-500">Finish a workout to see charts here.</p>
        ) : (
          <>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base dark:border-stone-700 dark:bg-stone-950"
            >
              {exerciseOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <div className="h-56">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={strengthData} margin={{ left: -10, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="e1rm" name="Est. 1RM" stroke="#2563eb" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Weekly volume (weight × reps)</h2>
        <div className="h-56">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="volume" name="Volume" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
