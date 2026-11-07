'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { prettyDate } from '@/lib/dates';
import { Card, PageTitle } from '@/components/ui';

type Row = {
  id: string;
  workout_date: string;
  label: string | null;
  status: string;
  workout_exercises: { sets: { weight: number; reps: number; is_warmup: boolean }[] }[];
};

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[] | null>(null);

  async function load() {
    const { data } = await supabase
      .from('workouts')
      .select('id, workout_date, label, status, workout_exercises(sets(weight, reps, is_warmup))')
      .neq('status', 'planned')
      .order('workout_date', { ascending: false })
      .limit(60);
    setRows((data ?? []) as unknown as Row[]);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function remove(id: string) {
    if (!confirm('Delete this workout and all its sets?')) return;
    await supabase.from('workouts').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-3">
      <PageTitle>History</PageTitle>
      {rows === null && <p className="text-stone-500">Loading…</p>}
      {rows?.length === 0 && <p className="text-stone-500">No workouts yet. Start one from the Today tab.</p>}
      {rows?.map((w) => {
        const sets = w.workout_exercises.flatMap((we) => we.sets).filter((s) => !s.is_warmup);
        const volume = sets.reduce((a, s) => a + Number(s.weight) * s.reps, 0);
        return (
          <Card key={w.id} className="flex items-center justify-between gap-3">
            <Link href={`/workout/${w.id}`} className="flex-1">
              <p className="font-semibold">{w.label ?? 'Workout'}</p>
              <p className="text-xs text-stone-500">
                {prettyDate(w.workout_date)} · {sets.length} sets · {Math.round(volume).toLocaleString()} volume
                {w.status !== 'done' ? ` · ${w.status.replace('_', ' ')}` : ''}
              </p>
            </Link>
            <button onClick={() => remove(w.id)} className="text-xs text-stone-400">
              Delete
            </button>
          </Card>
        );
      })}
    </div>
  );
}
