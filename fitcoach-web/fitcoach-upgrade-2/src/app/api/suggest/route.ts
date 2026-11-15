import { userFromRequest } from '@/lib/server/admin';
import { generateWorkout } from '@/lib/server/ai';

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const date: string = body.date ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: 'A date (YYYY-MM-DD) is required' }, { status: 400 });

  try {
    // Optional: plan a specific workout type from the user's split, and/or replace a planned workout
    const dayLabel = typeof body.day_label === 'string' && body.day_label.length <= 60 ? body.day_label : undefined;
    const replaceId =
      typeof body.replace_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.replace_id) ? body.replace_id : undefined;
    return Response.json(await generateWorkout(user.id, date, { regenerate: !!body.regenerate, dayLabel, replaceId }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Something went wrong' }, { status: 500 });
  }
}
