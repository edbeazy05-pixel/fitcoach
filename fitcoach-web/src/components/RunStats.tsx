'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import { addDays, todayIn, weekdayOf } from '@/lib/dates';
import { fmtPace, roundTo, secondsPerMile } from '@/lib/runs';
import { Card } from '@/components/ui';

type RunLite = { run_date: string; distance_mi: number; duration_seconds: number };

const mondayOf = (date: string) => addDays(date, -((weekdayOf(date) + 6) % 7));

// Pace is stored on the chart as decimal minutes per mile (8.7 = 8:42)
const paceLabel = (minutes: number) => fmtPace(minutes * 60);

export function RunStats({ tz }: { tz: string }) {
  const [runs, setRuns] = useState<RunLite[] | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    (async () => {
      setMounted(true);
      const { data } = await supabase
        .from('runs')
        .select('run_date, distance_mi, duration_seconds')
        .gte('run_date', addDays(todayIn(tz), -400))
        .order('run_date', { ascending: true })
        .limit(1000);
      setRuns(((data ?? []) as RunLite[]).map((r) => ({ ...r, distance_mi: Number(r.distance_mi) })));
    })();
  }, [tz]);

  if (runs === null) return null;

  const today = todayIn(tz);
  const thisMonday = mondayOf(today);
  const month = today.slice(0, 7);

  const weekMiles = runs.filter((r) => r.run_date >= thisMonday).reduce((a, r) => a + r.distance_mi, 0);
  const monthMiles = runs.filter((r) => r.run_date.startsWith(month)).reduce((a, r) => a + r.distance_mi, 0);
  const longest = runs.reduce((a, r) => Math.max(a, r.distance_mi), 0);

  const last30 = runs.filter((r) => r.run_date >= addDays(today, -30));
  const miles30 = last30.reduce((a, r) => a + r.distance_mi, 0);
  const secs30 = last30.reduce((a, r) => a + r.duration_seconds, 0);

  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisMonday, -7 * (7 - i)));
  const weekly = weeks.map((w) => ({
    week: w.slice(5),
    miles: roundTo(
      runs.filter((r) => mondayOf(r.run_date) === w).reduce((a, r) => a + r.distance_mi, 0)
    ),
  }));

  // Pace of each recent run, ignoring very short runs that skew the trend
  const paceSeries = runs
    .filter((r) => r.distance_mi >= 1)
    .slice(-20)
    .map((r) => ({ date: r.run_date.slice(5), pace: secondsPerMile(r.distance_mi, r.duration_seconds) / 60 }));

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Running</h2>
        <Link href="/runs/new" className="text-sm font-semibold text-blue-600">
          + Log a run
        </Link>
      </div>

      {runs.length === 0 ? (
        <p className="text-sm text-stone-500">Log a run to see your mileage and pace here.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Tile label="This week" value={`${roundTo(weekMiles)} mi`} />
            <Tile label="This month" value={`${roundTo(monthMiles)} mi`} />
            <Tile label="Longest run" value={`${roundTo(longest)} mi`} />
          </div>
          {miles30 > 0 && (
            <p className="text-sm text-stone-500">
              Average pace, last 30 days: <span className="font-semibold text-stone-900 dark:text-stone-100">{fmtPace(secs30 / miles30)} /mi</span>
            </p>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-stone-500">Miles per week</p>
            <div className="h-44">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly} margin={{ left: -10, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="miles" name="Miles" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {paceSeries.length > 1 && (
            <div>
              <p className="mb-2 text-xs font-medium text-stone-500">Pace per run (lower is faster)</p>
              <div className="h-44">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={paceSeries} margin={{ left: -4, right: 8, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} tickFormatter={(v: number) => paceLabel(v)} />
                      <Tooltip formatter={(value) => [`${paceLabel(Number(value))} /mi`, 'Pace']} />
                      <Line type="monotone" dataKey="pace" stroke="#10b981" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-2 py-3 dark:bg-stone-800/60">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}
