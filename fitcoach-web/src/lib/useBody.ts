'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { todayIn } from './dates';
import { loadBodyContext } from './bodyData';
import type { BodyContext } from './body';

/** The signed-in user's body and nutrition context (same numbers the AI coach sees). Null while loading. */
export function useBodyContext(tz: string) {
  const [ctx, setCtx] = useState<BodyContext | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const c = await loadBodyContext(supabase, data.session.user.id, todayIn(tz));
      if (live) setCtx(c);
    })();
    return () => { live = false; };
  }, [tz]);
  return ctx;
}
