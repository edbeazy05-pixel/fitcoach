'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { EQUIPMENT_OPTIONS } from '@/lib/splitTemplates';
import type { Profile } from '@/lib/types';
import { Button, Card, ErrorText, Field, Input, PageTitle } from '@/components/ui';

const select =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base dark:border-stone-700 dark:bg-stone-950';

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<Profile['goal']>('size');
  const [experience, setExperience] = useState<Profile['experience']>('intermediate');
  const [units, setUnits] = useState<Profile['units']>('lb');
  const [minutes, setMinutes] = useState(60);
  const [timezone, setTimezone] = useState('America/Chicago');
  const [equipment, setEquipment] = useState<string[]>(['barbell', 'dumbbell', 'machine', 'cable', 'body only']);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago');
      const { data } = await supabase.from('profiles').select('*').maybeSingle();
      if (!data) return;
      const p = data as Profile;
      setName(p.display_name ?? '');
      setGoal(p.goal);
      setExperience(p.experience);
      setUnits(p.units);
      setMinutes(p.session_minutes);
      setTimezone(p.timezone);
      setEquipment(p.equipment);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setError('');
    setMsg('');
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setError('Not signed in');
    const { error } = await supabase.from('profiles').upsert({
      id: u.user.id,
      display_name: name || null,
      goal,
      experience,
      units,
      session_minutes: minutes,
      timezone,
      equipment,
    });
    setSaving(false);
    if (error) setError(error.message);
    else setMsg('Saved');
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="space-y-4">
      <PageTitle>Profile</PageTitle>
      <Card className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Goal">
          <select className={select} value={goal ?? ''} onChange={(e) => setGoal(e.target.value as Profile['goal'])}>
            <option value="strength">Strength</option>
            <option value="size">Build muscle</option>
            <option value="fat_loss">Fat loss</option>
            <option value="general">General fitness</option>
          </select>
        </Field>
        <Field label="Experience">
          <select
            className={select}
            value={experience ?? ''}
            onChange={(e) => setExperience(e.target.value as Profile['experience'])}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Units">
            <select className={select} value={units} onChange={(e) => setUnits(e.target.value as Profile['units'])}>
              <option value="lb">lb</option>
              <option value="kg">kg</option>
            </select>
          </Field>
          <Field label="Session length (min)">
            <Input type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 60)} />
          </Field>
        </div>
        <Field label="Time zone (used for the nightly plan)">
          <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </Field>
        <div>
          <p className="mb-2 text-xs font-medium text-stone-500">Equipment you have</p>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT_OPTIONS.map((eq) => (
              <button
                key={eq}
                onClick={() => setEquipment((c) => (c.includes(eq) ? c.filter((x) => x !== eq) : [...c, eq]))}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  equipment.includes(eq) ? 'bg-blue-600 text-white' : 'bg-stone-100 dark:bg-stone-800'
                }`}
              >
                {eq}
              </button>
            ))}
          </div>
        </div>
        <ErrorText>{error}</ErrorText>
        {msg && <p className="text-sm text-green-600">{msg}</p>}
        <Button disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
      </Card>
      <Button variant="ghost" className="w-full" onClick={signOut}>
        Sign out
      </Button>
    </div>
  );
}
