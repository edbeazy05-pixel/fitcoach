'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EQUIPMENT_OPTIONS } from '@/lib/splitTemplates';
import type { Exercise } from '@/lib/types';
import { Button, ErrorText, Field, Input } from '@/components/ui';

export const MUSCLES = [
  'chest', 'lats', 'middle back', 'lower back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals', 'traps',
];

const COLUMNS = 'id, name, primary_muscle, equipment, is_compound, instructions, user_id';

const selectClass =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base dark:border-stone-700 dark:bg-stone-950';

type Props = {
  onPick: (e: Exercise) => void;
  onClose: () => void;
  title?: string;
  /** Swap mode: only show this muscle, hide the muscle chips. */
  lockMuscle?: string;
  /** Exercises already in the workout. */
  excludeIds?: string[];
  /** The user's equipment, used for the "only my equipment" filter in swap mode. */
  myEquipment?: string[];
  allowCreate?: boolean;
};

export function ExercisePicker({ onPick, onClose, title, lockMuscle, excludeIds = [], myEquipment, allowCreate }: Props) {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState(lockMuscle ?? '');
  const [onlyMine, setOnlyMine] = useState(!!myEquipment?.length);
  const [results, setResults] = useState<Exercise[]>([]);
  const [creating, setCreating] = useState(false);
  const excludeKey = excludeIds.join(',');

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      let q = supabase.from('exercises').select(COLUMNS).order('name').limit(80);
      if (search) q = q.ilike('name', `%${search}%`);
      if (muscle) q = q.eq('primary_muscle', muscle);
      if (onlyMine && myEquipment?.length) q = q.in('equipment', Array.from(new Set([...myEquipment, 'body only'])));
      const { data } = await q;
      const skip = new Set(excludeKey ? excludeKey.split(',') : []);
      const list = ((data ?? []) as Exercise[]).filter((e) => !skip.has(e.id));
      // Your own exercises first, so they are easy to find
      list.sort((a, b) => Number(!!b.user_id) - Number(!!a.user_id));
      if (!cancelled) setResults(list.slice(0, 50));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, muscle, onlyMine, myEquipment, excludeKey]);

  if (creating) {
    return (
      <Sheet>
        <CreateExerciseForm
          defaultMuscle={lockMuscle ?? (muscle || 'chest')}
          onCancel={() => setCreating(false)}
          onCreated={(ex) => onPick(ex)}
        />
      </Sheet>
    );
  }

  return (
    <Sheet>
      {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
      <div className="mb-3 flex items-center gap-2">
        <Input autoFocus placeholder="Search exercises" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {!lockMuscle && (
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
      )}

      {!!myEquipment?.length && (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
          Only exercises for my equipment
        </label>
      )}

      {allowCreate && (
        <button onClick={() => setCreating(true)} className="mb-3 text-left text-sm font-semibold text-blue-600">
          + Create a custom exercise
        </button>
      )}

      <ul className="flex-1 space-y-2 overflow-y-auto pb-8">
        {results.map((ex) => (
          <li key={ex.id}>
            <button
              onClick={() => onPick(ex)}
              className="w-full rounded-xl bg-white p-3 text-left ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800"
            >
              <p className="font-medium">
                {ex.name}
                {ex.user_id && (
                  <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-800">custom</span>
                )}
              </p>
              <p className="text-xs text-stone-500">
                {ex.primary_muscle} · {ex.equipment}
              </p>
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="py-6 text-center text-sm text-stone-500">
            No matches.{lockMuscle && onlyMine ? ' Try turning off the equipment filter.' : ''}
          </li>
        )}
      </ul>
    </Sheet>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-stone-100 dark:bg-stone-950">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {children}
      </div>
    </div>
  );
}

/* ---------- create a custom exercise ---------- */

export function CreateExerciseForm({
  defaultMuscle,
  onCancel,
  onCreated,
}: {
  defaultMuscle: string;
  onCancel: () => void;
  onCreated: (e: Exercise) => void;
}) {
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState(defaultMuscle);
  const [equipment, setEquipment] = useState('machine');
  const [compound, setCompound] = useState(false);
  const [how, setHow] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError('');
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setBusy(false);
      return setError('Not signed in');
    }
    const { data, error } = await supabase
      .from('exercises')
      .insert({
        name: name.trim(),
        primary_muscle: muscle,
        equipment,
        is_compound: compound,
        instructions: how.trim() || null,
        user_id: u.user.id,
      })
      .select(COLUMNS)
      .single();
    setBusy(false);
    if (error) {
      return setError(
        error.code === '23505'
          ? 'An exercise with that name already exists. Search for it, or choose a different name.'
          : error.message
      );
    }
    onCreated(data as Exercise);
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto pb-8">
      <h2 className="text-lg font-bold">New custom exercise</h2>
      <Field label="Name">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hammer Strength incline press" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Main muscle">
          <select className={selectClass} value={muscle} onChange={(e) => setMuscle(e.target.value)}>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Equipment">
          <select className={selectClass} value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            {[...EQUIPMENT_OPTIONS, 'other'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={compound} onChange={(e) => setCompound(e.target.checked)} />
        Compound lift (uses several joints, longer rest and bigger weight jumps)
      </label>
      <Field label="How to do it (optional, one step per line)">
        <textarea
          value={how}
          onChange={(e) => setHow(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base dark:border-stone-700 dark:bg-stone-950"
        />
      </Field>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy || name.trim().length < 2} onClick={save}>
          {busy ? 'Saving…' : 'Save and use it'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
