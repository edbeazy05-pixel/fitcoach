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
    return Response.json(await generateWorkout(user.id, date, !!body.regenerate));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Something went wrong' }, { status: 500 });
  }
}
