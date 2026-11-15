'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/api';
import { addDays, prettyDate, todayIn } from '@/lib/dates';
import { effectiveDay, type Effective, type SplitDayLite, type TrainedDay } from '@/lib/schedule';
import { fmtDuration, fmtPace, runTypeLabel, secondsPerMile } from '@/lib/runs';
import type { Profile, Run } from '@/lib/types';
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

type PlanOptions = { dayLabel?: string; regenerate?: boolean; replaceId?: string; open?: boolean };
type SheetState = { date: string; mode: 'change' | 'add'; replaceId?: string } | null;

const STATUS_TEXT: Record<DayWorkout['status'], string> = {
  planned: 'ready to start',
  in_progress: 'in progress',
  done: 'finished',
  skipped: 'skipped',
};

export default function TodayPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [today, setToday] = useState('');
  const [tomorrow, setTomorrow] = useState('');
  const [splitDays, setSplitDays] = useState<SplitDayLite[]>([]);
  const [workouts, setWorkouts] = useState<DayWorkout[]>([]);
  const [trained, setTrained] = useState<TrainedDay[]>([]);
  const [earliest, setEarliest] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
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

    const [days, planned, past, first, todayRuns] = await Promise.all([
      supabase.from('split_days').select('weekday, label, target_muscles, splits!inner(is_active)').eq('splits.is_active', true),
      supabase
        .from('workouts')
        .select(
          'id, workout_date, label, status, source, ai_rationale, workout_exercises(position, target_sets, target_reps_min, target_reps_max, exercises(name, primary_muscle))'
        )
        .in('workout_date', [t0, t1])
        .order('workout_date'),
      supabase
        .from('workouts')
        .select('workout_date, label')
        .in('status', ['done', 'in_progress'])
        .gte('workout_date', addDays(t0, -8))
        .lte('workout_date', t1),
      supabase
        .from('workouts')
        .select('workout_date')
        .in('status', ['done', 'in_progress'])
        .order('workout_date', { ascending: true })
        .limit(1),
      supabase.from('runs').select('*').eq('run_date', t0).order('created_at'),
    ]);

    setSplitDays((days.data ?? []) as unknown as SplitDayLite[]);
    setWorkouts((planned.data ?? []) as unknown as DayWorkout[]);
    setTrained(
      ((past.data ?? []) as { workout_date: string; label: string | null }[]).map((r) => ({ date: r.workout_date, label: r.label }))
    );
    setEarliest((first.data?.[0] as { workout_date: string } | undefined)?.workout_date ?? null);
    setRuns(((todayRuns.data ?? []) as Run[]).map((r) => ({ ...r, distance_mi: Number(r.distance_mi) })));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

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

  async function plan(date: string, opts: PlanOptions = {}) {
    setBusy(`plan-${date}`);
    setError('');
    try {
      const r = await authedPost<{ workout_id?: string; rest_day?: boolean }>('/api/suggest', {
        date,
        regenerate: !!opts.regenerate,
        day_label: opts.dayLabel,
        replace_id: opts.replaceId,
      });
      if (r.rest_day) setError('That is a rest day in your split. Use Change type to train anyway.');
      else if (opts.open && r.workout_id) return router.push(`/workout/${r.workout_id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not plan the workout');
    }
    setBusy('');
  }

  if (profile === undefined) return <p className="py-8 text-center text-stone-500">Loading…</p>;

  const eff = (date: string): Effective => effectiveDay(date, splitDays, trained, earliest);
  const effToday = eff(today);
  const effTomorrow = eff(tomorrow);
  const typeChoices = Array.from(new Map(splitDays.map((d) => [d.label, d])).values());
  const listOn = (date: string) => workouts.filter((w) => w.workout_date === date && w.status !== 'skipped');
  const todayList = listOn(today);
  const tomorrowList = listOn(tomorrow);

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
      {profile && splitDays.length === 0 && (
        <Card>
          <p className="mb-3 text-sm">Pick a weekly split so the app knows what to train each day.</p>
          <Link href="/plan" className="text-sm font-semibold text-blue-600">
            Choose a split →
          </Link>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>

      <DayCard
        title="Today"
        date={today}
        effective={effToday}
        list={todayList}
        busy={busy}
        isToday
        onStart={(id) => router.push(`/workout/${id}`)}
        onPlan={(label) => plan(today, { dayLabel: label, open: true })}
        onEmpty={() => startManual(today, effToday.day?.label ?? null)}
        onChange={(replaceId) => setSheet({ date: today, mode: 'change', replaceId })}
        onAdd={() => setSheet({ date: today, mode: 'add' })}
        onSwitch={(label, replaceId) => plan(today, { dayLabel: label, replaceId, open: true })}
        onRegenerate={() => {}}
      />

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Runs</h2>
          <Link href="/runs/new" className="rounded-xl bg-stone-100 px-3 py-1.5 text-sm font-semibold dark:bg-stone-800">
            + Log a run
          </Link>
        </div>
        {runs.length === 0 ? (
          <p className="text-sm text-stone-500">No run logged today.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`/runs/${r.id}`} className="block">
                  <span className="font-semibold">{r.distance_mi} mi</span> · {fmtDuration(r.duration_seconds)} ·{' '}
                  {fmtPace(secondsPerMile(r.distance_mi, r.duration_seconds))} /mi
                  <span className="block text-xs text-stone-500">
                    {runTypeLabel(r.run_type)} · {r.location}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <DayCard
        title="Tomorrow"
        date={tomorrow}
        effective={effTomorrow}
        list={tomorrowList}
        busy={busy}
        onStart={(id) => router.push(`/workout/${id}`)}
        onPlan={(label) => plan(tomorrow, { dayLabel: label })}
        onEmpty={() => {}}
        onChange={(replaceId) => setSheet({ date: tomorrow, mode: 'change', replaceId })}
        onAdd={() => setSheet({ date: tomorrow, mode: 'add' })}
        onSwitch={(label, replaceId) => plan(tomorrow, { dayLabel: label, replaceId })}
        onRegenerate={(label) => plan(tomorrow, { dayLabel: label, regenerate: true })}
      />

      {sheet && (
        <TypeSheet
          title={sheet.mode === 'change' ? 'Change workout type' : 'Add a workout'}
          subtitle={`${prettyDate(sheet.date)}. The AI will plan the type you pick.`}
          choices={typeChoices}
          scheduled={eff(sheet.date).day?.label}
          onPick={(label) => {
            const s = sheet;
            setSheet(null);
            plan(s.date, { dayLabel: label, replaceId: s.replaceId, open: s.date === today });
          }}
          onEmpty={
            sheet.date === today
              ? () => {
                  setSheet(null);
                  startManual(today, null);
                }
              : undefined
          }
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

/* ---------- one day ---------- */

function DayCard({
  title,
  date,
  effective,
  list,
  busy,
  isToday,
  onStart,
  onPlan,
  onEmpty,
  onChange,
  onAdd,
  onSwitch,
  onRegenerate,
}: {
  title: string;
  date: string;
  effective: Effective;
  list: DayWorkout[];
  busy: string;
  isToday?: boolean;
  onStart: (id: string) => void;
  onPlan: (label: string) => void;
  onEmpty: () => void;
  onChange: (replaceId?: string) => void;
  onAdd: () => void;
  onSwitch: (label: string, replaceId: string) => void;
  onRegenerate: (label: string) => void;
}) {
  const planning = busy === `plan-${date}`;
  const label = effective.day?.label;
  // A planned AI workout of a different type than the split now calls for (for example, you trained late tonight)
  const stale =
    label && !list.some((w) => w.label === label)
      ? list.find((w) => w.source === 'ai' && w.status === 'planned' && w.label !== label)
      : undefined;

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">
          {title} · {date && prettyDate(date)}
        </h2>
        <span className="text-sm text-stone-500">{label ?? 'Rest day'}</span>
      </div>

      {effective.reason === 'shifted' && effective.original && (
        <p className="text-xs text-stone-500">
          Moved from {effective.original.label} to catch up on a missed workout. The shift ends at your next rest day, which is
          used to finish the week.
        </p>
      )}
      {effective.reason === 'shifted' && !effective.original && (
        <p className="text-xs text-stone-500">
          Your rest day is being used to catch up on a missed workout. Your normal split resumes after this.
        </p>
      )}
      {effective.reason === 'reset' && (
        <p className="text-xs text-stone-500">You missed 2 or more workout days, so you are back on your normal split.</p>
      )}

      {list.length === 0 &&
        (label ? (
          <div className="flex flex-wrap gap-2">
            <Button disabled={!!busy} onClick={() => onPlan(label)}>
              {planning ? 'Planning…' : `Plan ${label} with AI`}
            </Button>
            {isToday && (
              <Button variant="ghost" disabled={!!busy} onClick={onEmpty}>
                Start empty workout
              </Button>
            )}
            <Button variant="ghost" disabled={!!busy} onClick={() => onChange()}>
              Change type
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-stone-500">Nothing scheduled.</p>
            <button disabled={!!busy} onClick={() => onAdd()} className="text-sm font-semibold text-blue-600">
              {isToday ? 'Train anyway' : 'Plan a workout anyway'}
            </button>
          </div>
        ))}

      {list.map((w) => (
        <div key={w.id} className="space-y-2 rounded-xl bg-stone-50 p-3 dark:bg-stone-800/60">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-medium">{w.label ?? 'Workout'}</p>
            <span className="text-xs text-stone-500">{STATUS_TEXT[w.status]}</span>
          </div>

          {w.ai_rationale && w.status === 'planned' && (
            <p className="text-sm text-stone-600 dark:text-stone-300">{w.ai_rationale}</p>
          )}

          {(w.status === 'planned' || !isToday) && w.workout_exercises.length > 0 && (
            <ul className="space-y-1 text-sm">
              {[...w.workout_exercises]
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
          )}

          <div className="flex flex-wrap items-center gap-3">
            {isToday && (
              <button
                onClick={() => onStart(w.id)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                {w.status === 'planned' ? 'Start workout' : w.status === 'done' ? 'View workout' : 'Continue workout'}
              </button>
            )}
            {!isToday && w.status === 'planned' && w.source === 'ai' && w.label && (
              <button
                disabled={!!busy}
                onClick={() => onRegenerate(w.label!)}
                className="text-sm font-semibold text-blue-600"
              >
                {planning ? 'Planning…' : 'Regenerate'}
              </button>
            )}
            {w.status === 'planned' && (
              <button disabled={!!busy} onClick={() => onChange(w.id)} className="text-sm font-semibold text-blue-600">
                Change type
              </button>
            )}
          </div>
        </div>
      ))}

      {stale && label && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Based on what you have done, your split now calls for <strong>{label}</strong>, not {stale.label}.
          <button
            disabled={!!busy}
            onClick={() => onSwitch(label, stale.id)}
            className="mt-2 block font-semibold underline"
          >
            {planning ? 'Planning…' : `Switch to ${label}`}
          </button>
        </div>
      )}

      {list.length > 0 && (
        <button disabled={!!busy} onClick={onAdd} className="text-sm font-semibold text-blue-600">
          + Add another workout
        </button>
      )}
    </Card>
  );
}

/* ---------- choose a workout type ---------- */

function TypeSheet({
  title,
  subtitle,
  choices,
  scheduled,
  onPick,
  onEmpty,
  onClose,
}: {
  title: string;
  subtitle: string;
  choices: SplitDayLite[];
  scheduled?: string;
  onPick: (label: string) => void;
  onEmpty?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md space-y-3 rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-stone-500">{subtitle}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {choices.map((c) => (
            <button
              key={c.label}
              onClick={() => onPick(c.label)}
              className="rounded-xl bg-stone-100 px-3 py-3 text-left text-sm font-semibold dark:bg-stone-800"
            >
              {c.label}
              {c.label === scheduled && <span className="block text-xs font-normal text-stone-500">scheduled</span>}
            </button>
          ))}
        </div>
        {onEmpty && (
          <button onClick={onEmpty} className="text-sm font-semibold text-blue-600">
            Start an empty workout instead
          </button>
        )}
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
