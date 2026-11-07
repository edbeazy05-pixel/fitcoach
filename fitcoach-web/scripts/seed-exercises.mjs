// Loads ~870 exercises into your Supabase project.
// Run once from the project folder:  node --env-file=.env.local scripts/seed-exercises.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}

const SOURCE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const res = await fetch(SOURCE);
if (!res.ok) {
  console.error(`Could not download the exercise list (${res.status}). Open ${SOURCE}, save it as scripts/exercises.json and re-run.`);
  process.exit(1);
}
const raw = await res.json();

const rows = raw.map((e) => ({
  name: e.name,
  primary_muscle: e.primaryMuscles?.[0] ?? 'other',
  secondary_muscles: e.secondaryMuscles ?? [],
  equipment: e.equipment ?? 'other',
  is_compound: e.mechanic === 'compound',
  instructions: (e.instructions ?? []).join('\n'),
}));

const supabase = createClient(url, key, { auth: { persistSession: false } });
for (let i = 0; i < rows.length; i += 200) {
  const { error } = await supabase.from('exercises').upsert(rows.slice(i, i + 200), { onConflict: 'name' });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
}
console.log(`Seeded ${rows.length} exercises`);
