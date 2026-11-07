'use client';

import { useCallback, useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import { prettyDate, todayIn } from '@/lib/dates';
import type { BodyMetric } from '@/lib/types';
import { Button, Card, ErrorText, Field, Input } from '@/components/ui';

type MetricKey = 'weight' | 'body_fat' | 'waist' | 'chest' | 'hips' | 'arm' | 'thigh';

const FIELDS: { key: MetricKey; label: string; kind: 'weight' | 'percent' | 'length' }[] = [
  { key: 'weight', label: 'Body weight', kind: 'weight' },
  { key: 'body_fat', label: 'Body fat', kind: 'percent' },
  { key: 'waist', label: 'Waist', kind: 'length' },
  { key: 'chest', label: 'Chest', kind: 'length' },
  { key: 'hips', label: 'Hips', kind: 'length' },
  { key: 'arm', label: 'Arm', kind: 'length' },
  { key: 'thigh', label: 'Thigh', kind: 'length' },
];

export function BodyMetrics({ units, tz }: { units: 'lb' | 'kg'; tz: string }) {
  const unitFor = (kind: 'weight' | 'percent' | 'length') =>
    kind === 'weight' ? units : kind === 'percent' ? '%' : units === 'lb' ? 'in' : 'cm';

  const [entries, setEntries] = useState<BodyMetric[]>([]);
  const [date, setDate] = useState('');
  const [values, setValues] = useState<Record<MetricKey, string>>({
    weight: '', body_fat: '', waist: '', chest: '', hips: '', arm: '', thigh: '',
  });
  const [showMore, setShowMore] = useState(false);
  const [metric, setMetric] = useState<MetricKey>('weight');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [mounted, setMounted] = useState(false);

  const load = useCallback(async () => {
    setMounted(true);
    const { data } = await supabase
      .from('body_metrics')
      .select('id, measured_on, weight, body_fat, waist, chest, hips, arm, thigh')
      .order('measured_on', { ascending: true })
      .limit(1000);
    setEntries(
      ((data ?? []) as BodyMetric[]).map((e) => ({
        ...e,
        weight: e.weight === null ? null : Number(e.weight),
        body_fat: e.body_fat === null ? null : Number(e.body_fat),
        waist: e.waist === null ? null : Number(e.waist),
        chest: e.chest === null ? null : Number(e.chest),
        hips: e.hips === null ? null : Number(e.hips),
        arm: e.arm === null ? null : Number(e.arm),
        thigh: e.thigh === null ? null : Number(e.thigh),
      }))
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const today = todayIn(tz);
  const day = date || today;

  async function save() {
    setError('');
    setMsg('');
    const payload: Record<string, string | number> = { measured_on: day };
    for (const f of FIELDS) {
      const raw = values[f.key].trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return setError(`${f.label} must be a positive number.`);
      if (f.key === 'body_fat' && n >= 100) return setError('Body fat must be under 100%.');
      payload[f.key] = n;
    }
    if (Object.keys(payload).length === 1) return setError('Enter at least one number.');

    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSaving(false);
      return setError('Not signed in');
    }
    // One row per day: saving again on the same day updates only the fields you filled in
    const { error } = await supabase
      .from('body_metrics')
      .upsert({ ...payload, user_id: u.user.id }, { onConflict: 'user_id,measured_on' });
    setSaving(false);
    if (error) return setError(error.message);
    setMsg(`Saved for ${prettyDate(day)}`);
    setValues({ weight: '', body_fat: '', waist: '', chest: '', hips: '', arm: '', thigh: '' });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this entry?')) return;
    const { error } = await supabase.from('body_metrics').delete().eq('id', id);
    if (error) return setError(error.message);
    load();
  }

  const available = FIELDS.filter((f) => entries.some((e) => e[f.key] !== null));
  const activeKey = available.some((f) => f.key === metric) ? metric : available[0]?.key;
  const activeField = FIELDS.find((f) => f.key === activeKey);

  const series = activeKey
    ? entries
        .filter((e) => e[activeKey] !== null)
        .map((e) => ({ date: e.measured_on, label: e.measured_on.slice(5), value: e[activeKey] as number }))
    : [];

  const first = series[0];
  const last = series[series.length - 1];
  const change = first && last && series.length > 1 ? Math.round((last.value - first.value) * 10) / 10 : null;
  const recent = [...entries].reverse().slice(0, 5);

  return (
    <Card className="space-y-4">
      <h2 className="font-semibold">Body weight and measurements</h2>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" max={today} value={day} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={`Weight (${units})`}>
            <Input
              inputMode="decimal"
              value={values.weight}
              onChange={(e) => setValues((v) => ({ ...v, weight: e.target.value }))}
            />
          </Field>
        </div>

        {showMore && (
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.filter((f) => f.key !== 'weight').map((f) => (
              <Field key={f.key} label={`${f.label} (${unitFor(f.kind)})`}>
                <Input
                  inputMode="decimal"
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
        )}

        <button onClick={() => setShowMore((v) => !v)} className="text-xs font-semibold text-blue-600">
          {showMore ? 'Hide measurements' : 'Add body fat or measurements'}
        </button>

        <ErrorText>{error}</ErrorText>
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <Button disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save entry'}
        </Button>
      </div>

      {available.length > 0 && activeField && (
        <div className="space-y-3 border-t border-stone-100 pt-4 dark:border-stone-800">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {available.map((f) => (
              <button
                key={f.key}
                onClick={() => setMetric(f.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  activeKey === f.key ? 'bg-blue-600 text-white' : 'bg-stone-100 dark:bg-stone-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {last && (
            <p className="text-sm">
              <span className="text-2xl font-bold">
                {last.value} {unitFor(activeField.kind)}
              </span>
              {change !== null && (
                <span className="ml-2 text-stone-500">
                  {change > 0 ? '+' : ''}
                  {change} since {prettyDate(first.date)}
                </span>
              )}
            </p>
          )}

          <div className="h-52">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ left: -10, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={`${activeField.label} (${unitFor(activeField.kind)})`}
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="space-y-1 border-t border-stone-100 pt-4 dark:border-stone-800">
          <p className="text-xs font-medium text-stone-500">Recent entries</p>
          <ul className="divide-y divide-stone-100 text-sm dark:divide-stone-800">
            {recent.map((e) => {
              const bits = FIELDS.filter((f) => e[f.key] !== null).map(
                (f) => `${f.label.toLowerCase()} ${e[f.key]} ${unitFor(f.kind)}`
              );
              return (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                  <span>
                    {prettyDate(e.measured_on)}
                    <span className="block text-xs text-stone-500">{bits.join(' · ')}</span>
                  </span>
                  <button onClick={() => remove(e.id)} className="shrink-0 text-xs text-stone-400">
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
