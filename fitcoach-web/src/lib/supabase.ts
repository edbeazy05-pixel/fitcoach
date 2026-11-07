import { createClient } from '@supabase/supabase-js';

// Browser client. The publishable key is safe here because row-level security limits every query to the signed-in user.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
  process.env.NEXT_PUBLIC_SUPABASE_KEY ?? 'missing-key',
  { auth: { persistSession: true, autoRefreshToken: true } }
);
