import { isCron } from '@/lib/server/admin';
import { allProfiles, generateWorkout, tomorrowFor } from '@/lib/server/ai';

export const maxDuration = 60;

// Called by Vercel Cron (see vercel.json). Plans tomorrow's workout for every user.
export async function GET(req: Request) {
  if (!isCron(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const results: Record<string, string> = {};
  for (const p of await allProfiles()) {
    try {
      const r = await generateWorkout(p.id, tomorrowFor(p.timezone));
      results[p.id] = 'rest_day' in r ? 'rest day' : 'planned';
    } catch (e) {
      results[p.id] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return Response.json(results);
}
