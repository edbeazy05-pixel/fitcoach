import { isCron } from '@/lib/server/admin';
import { allProfiles, generateReview, todayFor } from '@/lib/server/ai';

export const maxDuration = 60;

// Called by Vercel Cron on Sunday evening. Writes the weekly review for every user.
export async function GET(req: Request) {
  if (!isCron(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const results: Record<string, string> = {};
  for (const p of await allProfiles()) {
    try {
      await generateReview(p.id, todayFor(p.timezone));
      results[p.id] = 'ok';
    } catch (e) {
      results[p.id] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return Response.json(results);
}
