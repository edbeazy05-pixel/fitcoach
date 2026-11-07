import { userFromRequest } from '@/lib/server/admin';
import { generateReview } from '@/lib/server/ai';

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const weekEnd: string = body.week_end ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekEnd)) return Response.json({ error: 'week_end (YYYY-MM-DD) is required' }, { status: 400 });

  try {
    return Response.json(await generateReview(user.id, weekEnd));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Something went wrong' }, { status: 500 });
  }
}
