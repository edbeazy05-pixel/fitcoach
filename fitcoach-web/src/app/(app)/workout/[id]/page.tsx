'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { estimate1RM, increment, nextTarget, warmups } from '@/lib/overload';
import { prettyDate } from '@/lib/dates';
import type { Exercise, HistoryRow, Workout, WorkoutExercise } from '@/lib/types';
import { Button, Card, ErrorText, Input } from '@/components/ui';

type Prev = { date: string; sets: { weight: number; reps: number }[]; best1RM: number };

/* ---------- small hooks ---------- */

let audioCtx: AudioContext | null = null;

function beep() {
  try {
    navigator.vibrate?.([200, 100, 200]); // Android only; iOS ignores it
    if (!audioCtx) return;
    [0, 0.35].forEach((offset) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(audioCtx!.currentTime + offset);
      osc.stop(audioCtx!.currentTime + offset + 0.25);
    });
  } catch {
    /* sound is a nice-to-have */
  }
}

/** Rest timer that stores an end time, so it stays correct if the tab sleeps. */
function useRestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setEndsAt(null);
        beep();
      }
    }, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  return {
    remaining,
    running: endsAt !== null,
    start(seconds: number) {
      // Created on a tap so the browser allows sound later.
      if (!audioCtx) audioCtx = new AudioContext();
      audioCtx.resume?.();
      setRemaining(seconds);
      setEndsAt(Date.now() + seconds * 1000);
    },
    adjust(delta: number) {
      setEndsAt((e) => (e ? e + delta * 1000 : e));
      setRemaining((r) => Math.max(0, r + delta));
    },
    skip() {
      setEndsAt(null);
      setRemaining(0);
    },
  };
}

/** Keeps the screen on while a workout is in progress (supported on iOS 16.4+ and most browsers). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* denied or unsupported */
      }
    };
    request();
    const onVisible = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/* ---------- page ---------- */

export default function WorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [items, setItems] = useState<WorkoutExercise[]>([]);
  const [prev, setPrev] = useState<Record<string, Prev>>({});
  const [units, setUnits] = useState<'lb' | 'kg'>('lb');
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [prSets, setPrSets] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState('');
  const timer = useRestTimer();
  const prRef = useRef<Record<string, number>>({});

  useWakeLock(workout?.status === 'in_progress');

  const load = useCallback(async () => {
    const { data: w, error: we } = await supabase.from('workouts').select('*').eq('id', id).single();
    if (we || !w) {
      setError(we?.message ?? 'Workout not found');
      return;
    }
    const { data: rows } = await supabase
      .from('workout_exercises')
      .select('*, exercises(id, name, primary_muscle, equipment, is_compound), sets(*)')
      .eq('workout_id', id)
      .order('position');
    const list = ((rows ?? []) as unknown as WorkoutExercise[]).map((r) => ({
      ...r,
      sets: [...(r.sets ?? [])]
        .map((s) => ({ ...s, weight: Number(s.weight) }))
        .sort((a, b) => a.set_number - b.set_number),
    }));

    const { data: p } = await supabase.from('profiles').select('units').maybeSingle();
    if (p?.units) setUnits(p.units);

    // Previous sessions for these exercises (finished workouts before this one)
    const prevMap: Record<string, Prev> = {};
    const ids = list.map((r) => r.exercise_id);
    if (ids.length) {
      const { data: hist } = await supabase
        .from('exercise_history')
        .select('exercise_id, workout_date, set_number, weight, reps')
        .in('exercise_id', ids)
        .lt('workout_date', w.workout_date)
        .order('workout_date', { ascending: false })
        .limit(2000);
      for (const row of (hist ?? []) as HistoryRow[]) {
        const cur = (prevMap[row.exercise_id] ??= { date: row.workout_date, sets: [], best1RM: 0 });
        if (row.workout_date === cur.date) cur.sets.push({ weight: Number(row.weight), reps: row.reps });
        cur.best1RM = Math.max(cur.best1RM, estimate1RM(Number(row.weight), row.reps));
      }
    }
    prRef.current = Object.fromEntries(Object.entries(prevMap).map(([k, v]) => [k, v.best1RM]));
    setPrev(prevMap);
    setWorkout(w as Workout);
    setItems(list);
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function ensureStarted() {
    if (workout && workout.status === 'planned') {
      const started_at = new Date().toISOString();
      await supabase.from('workouts').update({ status: 'in_progress', started_at }).eq('id', workout.id);
      setWorkout({ ...workout, status: 'in_progress', started_at });
    }
  }

  async function logSet(we: WorkoutExercise, weight: number, reps: number) {
    setError('');
    await ensureStarted();
    const { data, error } = await supabase
      .from('sets')
      .insert({ workout_exercise_id: we.id, set_number: we.sets.length + 1, weight, reps, is_warmup: false })
      .select('*')
      .single();
    if (error) return setError(error.message);

    const newSet = { ...data, weight: Number(data.weight) };
    setItems((cur) => cur.map((x) => (x.id === we.id ? { ...x, sets: [...x.sets, newSet] } : x)));

    // Personal record: beats the best estimated 1RM from earlier sessions (and earlier sets today)
    const e1 = estimate1RM(weight, reps);
    const best = prRef.current[we.exercise_id];
    if (best !== undefined && best > 0 && e1 > best) setPrSets((p) => [...p, newSet.id]);
    prRef.current[we.exercise_id] = Math.max(best ?? 0, e1);

    timer.start(we.exercises.is_compound ? 150 : 90);
  }

  async function addWarmups(we: WorkoutExercise, workingWeight: number) {
    await ensureStarted();
    const ramp = warmups(workingWeight, units === 'lb' ? 5 : 2.5);
    const base = we.sets.length;
    const { data, error } = await supabase
      .from('sets')
      .insert(
        ramp.map((r, i) => ({
          workout_exercise_id: we.id,
          set_number: base + i + 1,
          weight: r.weight,
          reps: r.reps,
          is_warmup: true,
        }))
      )
      .select('*');
    if (error) return setError(error.message);
    const added = (data ?? []).map((s) => ({ ...s, weight: Number(s.weight) }));
    setItems((cur) => cur.map((x) => (x.id === we.id ? { ...x, sets: [...added, ...x.sets] } : x)));
  }

  async function deleteSet(we: WorkoutExercise, setId: string) {
    const { error } = await supabase.from('sets').delete().eq('id', setId);
    if (error) return setError(error.message);
    setItems((cur) => cur.map((x) => (x.id === we.id ? { ...x, sets: x.sets.filter((s) => s.id !== setId) } : x)));
  }

  async function addExercise(ex: Exercise) {
    setShowPicker(false);
    const { data, error } = await supabase
      .from('workout_exercises')
      .insert({ workout_id: id, exercise_id: ex.id, position: items.length })
      .select('*')
      .single();
    if (error) return setError(error.message);
    const { data: hist } = await supabase
      .from('exercise_history')
      .select('exercise_id, workout_date, set_number, weight, reps')
      .eq('exercise_id', ex.id)
      .lt('workout_date', workout?.workout_date ?? '9999-12-31')
      .order('workout_date', { ascending: false })
      .limit(300);
    const p: Prev = { date: '', sets: [], best1RM: 0 };
    for (const row of (hist ?? []) as HistoryRow[]) {
      if (!p.date) p.date = row.workout_date;
      if (row.workout_date === p.date) p.sets.push({ weight: Number(row.weight), reps: row.reps });
      p.best1RM = Math.max(p.best1RM, estimate1RM(Number(row.weight), row.reps));
    }
    if (p.date) {
      setPrev((cur) => ({ ...cur, [ex.id]: p }));
      prRef.current[ex.id] = p.best1RM;
    }
    setItems((cur) => [...cur, { ...(data as WorkoutExercise), exercises: ex, sets: [] }]);
  }

  async function removeExercise(we: WorkoutExercise) {
    if (we.sets.length && !confirm(`Remove ${we.exercises.name} and its ${we.sets.length} logged sets?`)) return;
    const { error } = await supabase.from('workout_exercises').delete().eq('id', we.id);
    if (error) return setError(error.message);
    setItems((cur) => cur.filter((x) => x.id !== we.id));
  }

  async function finish() {
    const { error } = await supabase
      .from('workouts')
      .update({ status: 'done', finished_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return setError(error.message);
    router.push('/history');
  }

  if (!loaded) return <p className="py-8 text-center text-stone-500">{error || 'Loading…'}</p>;
  if (!workout) return <ErrorText>{error}</ErrorText>;

  const startedMs = workout.started_at ? new Date(workout.started_at).getTime() : null;
  const endMs = workout.finished_at ? new Date(workout.finished_at).getTime() : now;
  const elapsed = startedMs ? Math.max(0, Math.floor((endMs - startedMs) / 1000)) : 0;
  const volume = items.reduce(
    (sum, we) => sum + we.sets.filter((s) => !s.is_warmup).reduce((a, s) => a + s.weight * s.reps, 0),
    0
  );

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-blue-600">
          ← Back
        </Link>
        <span className="text-sm tabular-nums text-stone-500">{startedMs ? mmss(elapsed) : '--:--'}</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{workout.label ?? 'Workout'}</h1>
        <p className="text-sm text-stone-500">
          {prettyDate(workout.workout_date)} · {workout.status.replace('_', ' ')} · {Math.round(volume).toLocaleString()} {units} volume
        </p>
      </div>

      {workout.ai_rationale && workout.status === 'planned' && (
        <Card>
          <p className="text-sm text-stone-600 dark:text-stone-300">{workout.ai_rationale}</p>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>

      {items.map((we) => (
        <ExerciseCard
          key={we.id}
          we={we}
          prev={prev[we.exercise_id]}
          units={units}
          prSets={prSets}
          onLog={(w, r) => logSet(we, w, r)}
          onWarmup={(w) => addWarmups(we, w)}
          onDeleteSet={(sid) => deleteSet(we, sid)}
          onRemove={() => removeExercise(we)}
        />
      ))}

      <Button variant="ghost" className="w-full" onClick={() => setShowPicker(true)}>
        + Add exercise
      </Button>

      {workout.status !== 'done' ? (
        <Button className="w-full" onClick={finish}>
          Finish workout
        </Button>
      ) : (
        <p className="text-center text-sm text-stone-500">This workout is finished. You can still fix typos above.</p>
      )}

      {timer.running && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-blue-700 pb-[env(safe-area-inset-bottom)] text-white">
          <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide opacity-80">Rest</p>
              <p className="text-2xl font-bold tabular-nums">{mmss(timer.remaining)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => timer.adjust(-15)} className="rounded-lg bg-white/20 px-3 py-2 text-sm font-semibold">
                −15
              </button>
              <button onClick={() => timer.adjust(15)} className="rounded-lg bg-white/20 px-3 py-2 text-sm font-semibold">
                +15
              </button>
              <button onClick={timer.skip} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-700">
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {showPicker && <ExercisePicker onPick={addExercise} onClose={() => setShowPicker(false)} />}
    </div>
  );
}

/* ---------- exercise card ---------- */

function ExerciseCard({
  we,
  prev,
  units,
  prSets,
  onLog,
  onWarmup,
  onDeleteSet,
  onRemove,
}: {
  we: WorkoutExercise;
  prev?: Prev;
  units: 'lb' | 'kg';
  prSets: string[];
  onLog: (weight: number, reps: number) => void;
  onWarmup: (workingWeight: number) => void;
  onDeleteSet: (setId: string) => void;
  onRemove: () => void;
}) {
  const repMin = we.target_reps_min ?? 8;
  const repMax = we.target_reps_max ?? 12;
  const target = nextTarget(prev?.sets ?? [], repMin, repMax, increment(units, we.exercises.is_compound));
  const working = we.sets.filter((s) => !s.is_warmup);
  const lastLogged = working[working.length - 1];

  const [weight, setWeight] = useState(String(lastLogged?.weight ?? target?.weight ?? prev?.sets[0]?.weight ?? ''));
  const [reps, setReps] = useState(String(lastLogged?.reps ?? target?.reps ?? ''));

  const w = Number(weight);
  const r = Number(reps);
  const valid = weight !== '' && reps !== '' && Number.isFinite(w) && w >= 0 && Number.isInteger(r) && r >= 1;

  const numberOf = (setId: string) => working.findIndex((x) => x.id === setId) + 1;

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold leading-tight">{we.exercises.name}</h2>
          <p className="text-xs text-stone-500">
            {we.exercises.primary_muscle}
            {we.target_sets ? ` · ${we.target_sets} sets of ${repMin}–${repMax}` : ''}
          </p>
        </div>
        <button onClick={onRemove} className="text-xs text-stone-400" aria-label="Remove exercise">
          Remove
        </button>
      </div>

      <div className="space-y-0.5 text-xs text-stone-500">
        {target && (
          <p>
            <span className="font-semibold text-blue-600">
              Target: {target.weight} {units} × {target.reps}
            </span>{' '}
            · {target.note}
          </p>
        )}
        {prev && prev.sets.length > 0 && (
          <p>
            Last ({prettyDate(prev.date)}): {prev.sets.map((s) => `${s.weight}×${s.reps}`).join(', ')}
          </p>
        )}
        {!prev && <p>No history yet. Today sets the baseline.</p>}
      </div>

      {we.sets.length > 0 && (
        <ul className="divide-y divide-stone-100 text-sm dark:divide-stone-800">
          {we.sets.map((s) => {
            return (
              <li key={s.id} className="flex items-center justify-between py-1.5">
                <span className={s.is_warmup ? 'text-stone-400' : ''}>
                  <span className="mr-2 inline-block w-6 text-xs text-stone-500">{s.is_warmup ? 'W' : numberOf(s.id)}</span>
                  {s.weight} {units} × {s.reps}
                  {prSets.includes(s.id) && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800">PR</span>
                  )}
                </span>
                <button onClick={() => onDeleteSet(s.id)} className="px-2 text-stone-400" aria-label="Delete set">
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-xs text-stone-500">Weight ({units})</span>
          <Input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className="w-20">
          <span className="mb-1 block text-xs text-stone-500">Reps</span>
          <Input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
        </label>
        <Button disabled={!valid} onClick={() => onLog(w, r)}>
          Log set
        </Button>
      </div>

      {we.sets.length === 0 && Number.isFinite(w) && w > 0 && (
        <button onClick={() => onWarmup(w)} className="text-xs font-semibold text-blue-600">
          Add warm-up sets for {w} {units}
        </button>
      )}
    </Card>
  );
}

/* ---------- exercise picker ---------- */

const MUSCLES = [
  'chest', 'lats', 'middle back', 'lower back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals', 'traps',
];

function ExercisePicker({ onPick, onClose }: { onPick: (e: Exercise) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('');
  const [results, setResults] = useState<Exercise[]>([]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      let q = supabase.from('exercises').select('id, name, primary_muscle, equipment, is_compound').order('name').limit(40);
      if (search) q = q.ilike('name', `%${search}%`);
      if (muscle) q = q.eq('primary_muscle', muscle);
      const { data } = await q;
      if (!cancelled) setResults((data ?? []) as Exercise[]);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, muscle]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-stone-100 dark:bg-stone-950">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-3 flex items-center gap-2">
          <Input autoFocus placeholder="Search exercises" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {['', ...MUSCLES].map((m) => (
            <button
              key={m || 'all'}
              onClick={() => setMuscle(m)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                muscle === m ? 'bg-blue-600 text-white' : 'bg-white dark:bg-stone-800'
              }`}
            >
              {m || 'all'}
            </button>
          ))}
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto pb-8">
          {results.map((ex) => (
            <li key={ex.id}>
              <button
                onClick={() => onPick(ex)}
                className="w-full rounded-xl bg-white p-3 text-left ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800"
              >
                <p className="font-medium">{ex.name}</p>
                <p className="text-xs text-stone-500">
                  {ex.primary_muscle} · {ex.equipment}
                </p>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="py-6 text-center text-sm text-stone-500">No matches. Did you run the exercise seed script?</li>}
        </ul>
      </div>
    </div>
  );
}
