'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { todayIn } from '@/lib/dates';
import type { Run } from '@/lib/types';
import { RunForm } from '@/components/RunForm';
import { Button, ErrorText, PageTitle } from '@/components/ui';

export default function EditRunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [today, setToday] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from('profiles').select('timezone').maybeSingle();
      setToday(todayIn(p?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone));
      const { data, error } = await supabase.from('runs').select('*').eq('id', id).single();
      if (error || !data) return setError(error?.message ?? 'Run not found');
      setRun({ ...(data as Run), distance_mi: Number(data.distance_mi) });
    })();
  }, [id]);

  async function remove() {
    if (!confirm('Delete this run?')) return;
    const { error } = await supabase.from('runs').delete().eq('id', id);
    if (error) return setError(error.message);
    router.push('/history');
  }

  return (
    <div className="space-y-3">
      <Link href="/history" className="text-sm font-semibold text-blue-600">
        ← Back
      </Link>
      <PageTitle>Edit run</PageTitle>
      <ErrorText>{error}</ErrorText>
      {run && today && (
        <>
          <RunForm initial={run} defaultDate={run.run_date} today={today} onSaved={() => router.push('/history')} />
          <Button variant="danger" className="w-full" onClick={remove}>
            Delete run
          </Button>
        </>
      )}
    </div>
  );
}
