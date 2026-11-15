'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { todayIn } from '@/lib/dates';
import { RunForm } from '@/components/RunForm';
import { PageTitle } from '@/components/ui';

export default function NewRunPage() {
  const router = useRouter();
  const [today, setToday] = useState('');

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from('profiles').select('timezone').maybeSingle();
      setToday(todayIn(p?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone));
    })();
  }, []);

  return (
    <div className="space-y-3">
      <Link href="/" className="text-sm font-semibold text-blue-600">
        ← Back
      </Link>
      <PageTitle>Log a run</PageTitle>
      {today && <RunForm defaultDate={today} today={today} onSaved={() => router.push('/history')} />}
    </div>
  );
}
