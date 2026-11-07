'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SPLIT_TEMPLATES } from '@/lib/splitTemplates';
import { WEEKDAYS } from '@/lib/dates';
import { Button, Card, ErrorText, PageTitle } from '@/components/ui';

type SplitDay = { weekday: number; label: string };

// Monday first, Sunday last
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function PlanPage() {
  const [current, setCurrent] = useState<{ name: string; days: SplitDay[] } | null>(null);
  const [template, setTemplate] = useState('Push / Pull / Legs');
  const [chosen, setChosen] = useState<number[]>([1, 3, 5]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const { data: split } = await supabase.from('splits').select('id, name').eq('is_active', true).maybeSingle();
    if (!split) return setCurrent(null);
    const { data: days } = await supabase.from('split_days').select('weekday, label').eq('split_id', split.id);
    setCurrent({ name: split.name, days: (days ?? []) as SplitDay[] });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const sortedChosen = ORDER.filter((d) => chosen.includes(d));
  const days = SPLIT_TEMPLATES[template];
  const preview = sortedChosen.map((wd, i) => ({ weekday: wd, ...days[i % days.length] }));

  async function save() {
    setSaving(true);
    setError('');
    const { error: e1 } = await supabase.from('splits').update({ is_active: false }).eq('is_active', true);
    if (e1) return fail(e1.message);
    const { data: split, error: e2 } = await supabase
      .from('splits')
      .insert({ name: template, is_active: true })
      .select('id')
      .single();
    if (e2) return fail(e2.message);
    const { error: e3 } = await supabase.from('split_days').insert(
      preview.map((p) => ({
        split_id: split.id,
        weekday: p.weekday,
        label: p.label,
        target_muscles: p.target_muscles,
      }))
    );
    if (e3) return fail(e3.message);
    setSaving(false);
    await load();
  }

  function fail(message: string) {
    setError(message);
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <PageTitle>Plan</PageTitle>

      {current && (
        <Card>
          <h2 className="mb-2 font-semibold">Current split: {current.name}</h2>
          <ul className="space-y-1 text-sm">
            {ORDER.map((wd) => {
              const d = current.days.find((x) => x.weekday === wd);
              return (
                <li key={wd} className="flex justify-between">
                  <span className="text-stone-500">{WEEKDAYS[wd]}</span>
                  <span>{d?.label ?? 'Rest'}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="font-semibold">{current ? 'Change your split' : 'Choose a split'}</h2>
        <div className="flex flex-wrap gap-2">
          {Object.keys(SPLIT_TEMPLATES).map((name) => (
            <button
              key={name}
              onClick={() => setTemplate(name)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                template === name ? 'bg-blue-600 text-white' : 'bg-stone-100 dark:bg-stone-800'
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-stone-500">Training days</p>
          <div className="flex gap-1.5">
            {ORDER.map((wd) => (
              <button
                key={wd}
                onClick={() => setChosen((c) => (c.includes(wd) ? c.filter((x) => x !== wd) : [...c, wd]))}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
                  chosen.includes(wd) ? 'bg-blue-600 text-white' : 'bg-stone-100 dark:bg-stone-800'
                }`}
              >
                {WEEKDAYS[wd]}
              </button>
            ))}
          </div>
        </div>

        {preview.length > 0 && (
          <ul className="space-y-1 text-sm">
            {preview.map((p) => (
              <li key={p.weekday} className="flex justify-between">
                <span className="text-stone-500">{WEEKDAYS[p.weekday]}</span>
                <span>{p.label}</span>
              </li>
            ))}
          </ul>
        )}

        <ErrorText>{error}</ErrorText>
        <Button disabled={saving || preview.length === 0} onClick={save}>
          {saving ? 'Saving…' : 'Save split'}
        </Button>
      </Card>
    </div>
  );
}
