'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/api';
import { addDays, prettyDate, todayIn, weekdayOf } from '@/lib/dates';
import type { Profile } from '@/lib/types';
import { Button, Card, ErrorText, PageTitle } from '@/components/ui';

type PlannedExercise = {
  position: number;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  exercises: { name: string; primary_muscle: string };
};
type DayWorkout = {
  id: string;
  workout_date: string;
  label: string | null;
  status: 'planned' | 'in_progress' | 'done' | 'skipped';
  source: 'manual' | 'ai';
  ai_rationale: string | null;
  workout_exercises: PlannedExercise[];
};
type SplitDay = { weekday: number; label: string };

export default function TodayPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [today, setToday] = useState('');
  const [tomorrow, setTomorrow] = useState('');
  const [days, setDays] = useState<SplitDay[]>([]);
  const [workouts, setWorkouts] = useState<DayWorkout[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data: p } = await supabase.from('profiles').select('*').maybeSingle();
    setProfile((p as Profile | null) ?? null);
    const tz = (p as Profile | null)?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const t0 = todayIn(tz);
    const t1 = addDays(t0, 1);
    setToday(t0);
    setTomorrow(t1);

    const { data: d } = await supabase
      .from('split_days')
      .select('weekday, label, splits!inner(is_active)')
      .eq('splits.is_active', true);
    setDays(((d ?? []) as unknown as SplitDay[]) ?? []);

    const { data: w } = await supabase
      .from('workouts')
      .select(
        'id, workout_date, label, status, source, ai_rationale, workout_exercises(position, target_sets, target_reps_min, target_reps_max, exercises(name, primary_muscle))'
      )
      .in('workout_date', [t0, t1])
      .order('workout_date');
    setWorkouts(((w ?? []) as unknown as DayWorkout[]) ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const dayLabel = (date: string) => days.find((d) => d.weekday === weekdayOf(date))?.label;
  const workoutOn = (date: string) => {
    const list = workouts.filter((w) => w.workout_date === date);
    return list.find((w) => w.status !== 'skipped') ?? null;
  };

  async function startManual(date: string, label: string | null) {
    setBusy('manual');
    setError('');
    const { data, error } = await supabase
      .from('workouts')
      .insert({
        workout_date: date,
        label,
        status: 'in_progress',
        source: 'manual',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    setBusy('');
    if (error) return setError(error.message);
    router.push(`/workout/${data.id}`);
  }

  async function plan(date: string, regenerate = false, open = false) {
    setBusy(`plan-${date}`);
    setError('');
    try {
      const r = await authedPost<{ workout_id?: string; rest_day?: boolean }>('/api/suggest', { date, regenerate });
      if (r.rest_day) setError('That is a rest day in your split.');
      else if (open && r.workout_id) return router.push(`/workout/${r.workout_id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not plan the workout');
    }
    setBusy('');
  }

  if (profile === undefined) return <p className="py-8 text-center text-stone-500">Loading…</p>;

  const todayWorkout = workoutOn(today);
  const tomorrowWorkout = workoutOn(tomorrow);
  const todayLabel = dayLabel(today);
  const tomorrowLabel = dayLabel(tomorrow);

  return (
    <div className="space-y-4">
      <PageTitle>{profile?.display_name ? `Hi, ${profile.display_name}` : 'Today'}</PageTitle>

      {!profile && (
        <Card>
          <p className="mb-3 text-sm">First, tell the app about your goal and equipment so it can plan workouts.</p>
          <Link href="/profile" className="text-sm font-semibold text-blue-600">
            Set up your profile →
          </Link>
        </Card>
      )}
      {profile && days.length === 0 && (
        <Card>
          <p className="mb-3 text-sm">Pick a weekly split so the app knows what to train each day.</p>
          <Link href="/plan" className="text-sm font-semibold text-blue-600">
            Choose a split →
          </Link>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>

      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Today · {today && prettyDate(today)}</h2>
          <span className="text-sm text-stone-500">{todayLabel ?? 'Rest day'}</span>
        </div>
        {todayWorkout ? (
          <>
            <p className="text-sm text-stone-500">
              {todayWorkout.label ?? 'Workout'} ·{' '}
              {todayWorkout.status === 'planned' ? 'ready to start' : todayWorkout.status.replace('_', ' ')}
            </p>
            <Link
              href={`/workout/${todayWorkout.id}`}
              className="block rounded-xl bg-blue-600 py-2.5 text-center text-sm font-semibold text-white"
            >
              {todayWorkout.status === 'planned' ? 'Start workout' : todayWorkout.status === 'done' ? 'View workout' : 'Continue workout'}
            </Link>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            {todayLabel && (
              <Button disabled={!!busy} onClick={() => plan(today, false, true)}>
                {busy === `plan-${today}` ? 'Planning…' : `Plan ${todayLabel} with AI`}
              </Button>
            )}
            <Button variant="ghost" disabled={!!busy} onClick={() => startManual(today, todayLabel ?? null)}>
              Start empty workout
            </Button>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Tomorrow · {tomorrow && prettyDate(tomorrow)}</h2>
          <span className="text-sm text-stone-500">{tomorrowLabel ?? 'Rest day'}</span>
        </div>
        {tomorrowWorkout ? (
          <>
            {tomorrowWorkout.ai_rationale && <p className="text-sm text-stone-600 dark:text-stone-300">{tomorrowWorkout.ai_rationale}</p>}
            <ul className="space-y-1 text-sm">
              {[...tomorrowWorkout.workout_exercises]
                .sort((a, b) => a.position - b.position)
                .map((we) => (
                  <li key={we.position} className="flex justify-between gap-3">
                    <span>{we.exercises.name}</span>
                    <span className="shrink-0 text-stone-500">
                      {we.target_sets}×{we.target_reps_min}–{we.target_reps_max}
                    </span>
                  </li>
                ))}
            </ul>
            {tomorrowWorkout.source === 'ai' && tomorrowWorkout.status === 'planned' && (
              <Button variant="ghost" disabled={!!busy} onClick={() => plan(tomorrow, true)}>
                {busy === `plan-${tomorrow}` ? 'Planning…' : 'Regenerate'}
              </Button>
            )}
          </>
        ) : tomorrowLabel ? (
          <Button disabled={!!busy} onClick={() => plan(tomorrow)}>
            {busy === `plan-${tomorrow}` ? 'Planning…' : `Plan ${tomorrowLabel} with AI`}
          </Button>
        ) : (
          <p className="text-sm text-stone-500">Nothing scheduled.</p>
        )}
      </Card>
    </div>
  );
}
