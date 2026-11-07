import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Server-only Supabase client using the secret key. It bypasses row-level security, so never import it from a browser file. */
export function admin() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error('Server is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

/** The signed-in user behind a request's bearer token, or null. */
export async function userFromRequest(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data.user ?? null;
}

/** True when the request carries the cron secret (Vercel Cron sends it as a bearer token). */
export function isCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}
