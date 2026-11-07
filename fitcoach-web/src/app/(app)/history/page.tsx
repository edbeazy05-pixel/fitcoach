'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { addDays, prettyDate, todayIn, weekdayOf } from '@/lib/dates';
import { Card, ErrorText, PageTitle } from '@/components/ui';

type Row = {
  id: string;
  workout_date: string;
  label: string | null;
  status: 'planned' | 'in_progress' | 'done' | 'skipped';
  session_rpe: number | null;
  notes: string | null;
  workout_exercises: { sets: { weight: number; reps: number; is_warmup: boolean }[] }[];
};

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const monthOf = (date: string) => date.slice(0, 7);

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function HistoryPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tz, setTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [month, setMonth] = useState('');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data: p } = await supabase.from('profiles').select('timezone').maybeSingle();
    const zone = p?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTz(zone);
    const today = todayIn(zone);
    setMonth((m) => m || monthOf(today));
    setSelected((s) => s || today);

    const { data } = await supabase
      .from('workouts')
      .select('id, workout_date, label, status, session_rpe, notes, workout_exercises(sets(weight, reps, is_warmup))')
      .gte('workout_date', addDays(today, -400))
      .order('workout_date', { ascending: false })
      .limit(600);
    setRows((data ?? []) as unknown as Row[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm('Delete this workout and all its sets?')) return;
    const { error } = await supabase.from('workouts').delete().eq('id', id);
    if (error) return setError(error.message);
    load();
  }

  async function repeat(w: Row) {
    setBusy(w.id);
    setError('');
    const { data: src, error: e1 } = await supabase
      .from('workout_exercises')
      .select('exercise_id, position, target_sets, target_reps_min, target_reps_max, sets(is_warmup)')
      .eq('workout_id', w.id)
      .order('position');
    if (e1) {
      setBusy('');
      return setError(e1.message);
    }
    if (!src?.length) {
      setBusy('');
      return setError('That workout has no exercises to repeat.');
    }

    // Planned, so the clock starts when you log the first set
    const { data: created, error: e2 } = await supabase
      .from('workouts')
      .insert({ workout_date: todayIn(tz), label: w.label, status: 'planned', source: 'manual' })
      .select('id')
      .single();
    if (e2 || !created) {
      setBusy('');
      return setError(e2?.message ?? 'Could not create the workout');
    }

    const { error: e3 } = await supabase.from('workout_exercises').insert(
      src.map((r, i) => {
        const done = ((r.sets ?? []) as { is_warmup: boolean }[]).filter((s) => !s.is_warmup).length;
        return {
          workout_id: created.id,
          exercise_id: r.exercise_id,
          position: i,
          target_sets: done || r.target_sets,
          target_reps_min: r.target_reps_min,
          target_reps_max: r.target_reps_max,
        };
      })
    );
    if (e3) {
      await supabase.from('workouts').delete().eq('id', created.id);
      setBusy('');
      return setError(e3.message);
    }
    router.push(`/workout/${created.id}`);
  }

  const finished = useMemo(() => (rows ?? []).filter((r) => r.status !== 'planned').slice(0, 60), [rows]);

  return (
    <div className="space-y-3">
      <PageTitle>History</PageTitle>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1 dark:bg-stone-800">
        {(['list', 'calendar'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-lg py-2 text-sm font-semibold capitalize ${
              view === v ? 'bg-white shadow-sm dark:bg-stone-950' : 'text-stone-500'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <ErrorText>{error}</ErrorText>
      {rows === null && <p className="text-stone-500">Loading…</p>}

      {rows && view === 'list' && (
        <>
          {finished.length === 0 && <p className="text-stone-500">No workouts yet. Start one from the Today tab.</p>}
          {finished.map((w) => (
            <WorkoutCard key={w.id} w={w} busy={busy === w.id} onRepeat={repeat} onDelete={remove} />
          ))}
        </>
      )}

      {rows && view === 'calendar' && (
        <CalendarView
          rows={rows}
          month={month}
          setMonth={setMonth}
          selected={selected}
          setSelected={setSelected}
          today={todayIn(tz)}
          busyId={busy}
          onRepeat={repeat}
          onDelete={remove}
        />
      )}
    </div>
  );
}

/* ---------- one workout ---------- */

function WorkoutCard({
  w,
  busy,
  onRepeat,
  onDelete,
}: {
  w: Row;
  busy: boolean;
  onRepeat: (w: Row) => void;
  onDelete: (id: string) => void;
}) {
  const sets = w.workout_exercises.flatMap((we) => we.sets).filter((s) => !s.is_warmup);
  const volume = sets.reduce((a, s) => a + Number(s.weight) * s.reps, 0);
  return (
    <Card className="space-y-2">
      <Link href={`/workout/${w.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{w.label ?? 'Workout'}</p>
          {w.session_rpe && (
            <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-800">RPE {w.session_rpe}</span>
          )}
        </div>
        <p className="text-xs text-stone-500">
          {prettyDate(w.workout_date)} · {sets.length} sets · {Math.round(volume).toLocaleString()} volume
          {w.status !== 'done' ? ` · ${w.status.replace('_', ' ')}` : ''}
        </p>
        {w.notes && <p className="mt-1 line-clamp-2 text-xs italic text-stone-600 dark:text-stone-300">“{w.notes}”</p>}
      </Link>
      <div className="flex gap-4 text-xs font-semibold">
        <button disabled={busy} onClick={() => onRepeat(w)} className="text-blue-600 disabled:opacity-50">
          {busy ? 'Copying…' : 'Repeat today'}
        </button>
        <button onClick={() => onDelete(w.id)} className="text-stone-400">
          Delete
        </button>
      </div>
    </Card>
  );
}

/* ---------- calendar ---------- */

function CalendarView({
  rows,
  month,
  setMonth,
  selected,
  setSelected,
  today,
  busyId,
  onRepeat,
  onDelete,
}: {
  rows: Row[];
  month: string;
  setMonth: (m: string) => void;
  selected: string;
  setSelected: (d: string) => void;
  today: string;
  busyId: string;
  onRepeat: (w: Row) => void;
  onDelete: (id: string) => void;
}) {
  const byDate = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of rows) (map[r.workout_date] ??= []).push(r);
    return map;
  }, [rows]);

  const [y, m] = month.split('-').map(Number);
  const lead = (weekdayOf(`${month}-01`) + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const title = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const doneThisMonth = rows.filter((r) => r.status === 'done' && monthOf(r.workout_date) === month).length;
  const dayRows = byDate[selected] ?? [];

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="px-3 py-1 text-lg" aria-label="Previous month">
            ‹
          </button>
          <div className="text-center">
            <p className="font-semibold">{title}</p>
            <p className="text-xs text-stone-500">
              {doneThisMonth} workout{doneThisMonth === 1 ? '' : 's'} finished
            </p>
          </div>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="px-3 py-1 text-lg" aria-label="Next month">
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-stone-500">
          {DAY_HEADERS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <span key={`b${i}`} />;
            const date = `${month}-${String(day).padStart(2, '0')}`;
            const list = byDate[date] ?? [];
            const hasDone = list.some((r) => r.status === 'done');
            const hasActive = list.some((r) => r.status === 'in_progress');
            const hasPlanned = list.some((r) => r.status === 'planned');
            return (
              <button
                key={date}
                onClick={() => setSelected(date)}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg text-sm ${
                  date === selected ? 'bg-blue-600 text-white' : 'bg-stone-50 dark:bg-stone-800'
                } ${date === today && date !== selected ? 'ring-2 ring-blue-500' : ''}`}
              >
                <span>{day}</span>
                <span className="mt-0.5 flex h-1.5 gap-0.5">
                  {hasDone && <i className={`h-1.5 w-1.5 rounded-full ${date === selected ? 'bg-white' : 'bg-blue-600'}`} />}
                  {hasActive && <i className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                  {hasPlanned && (
                    <i className={`h-1.5 w-1.5 rounded-full border ${date === selected ? 'border-white' : 'border-stone-500'}`} />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
          <span>
            <i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />
            finished
          </span>
          <span>
            <i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />
            in progress
          </span>
          <span>
            <i className="mr-1 inline-block h-2 w-2 rounded-full border border-stone-500" />
            planned
          </span>
        </p>
      </Card>

      <h2 className="text-sm font-semibold text-stone-500">{prettyDate(selected)}</h2>
      {dayRows.length === 0 && <p className="text-sm text-stone-500">No workout on this day.</p>}
      {dayRows.map((w) => (
        <WorkoutCard key={w.id} w={w} busy={busyId === w.id} onRepeat={onRepeat} onDelete={onDelete} />
      ))}
    </div>
  );
}
