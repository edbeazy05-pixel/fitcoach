'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button, Card, ErrorText, Field, Input } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
    });
  }, [router]);

  async function submit(mode: 'in' | 'up') {
    setBusy(true);
    setError('');
    const creds = { email, password };
    const { data, error } =
      mode === 'in' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds);
    setBusy(false);
    if (error) return setError(error.message);
    if (mode === 'up' && !data.session) {
      return setError('Account created. Check your email to confirm it, then sign in.');
    }
    router.replace('/');
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-1 text-3xl font-bold tracking-tight">FitCoach</h1>
      <p className="mb-6 text-stone-500">Log workouts. Get tomorrow planned.</p>
      <Card className="space-y-4">
        <Field label="Email">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy || !email || password.length < 6} onClick={() => submit('in')}>
            Sign in
          </Button>
          <Button
            variant="ghost"
            className="flex-1"
            disabled={busy || !email || password.length < 6}
            onClick={() => submit('up')}
          >
            Create account
          </Button>
        </div>
        <p className="text-xs text-stone-500">Passwords need at least 6 characters.</p>
      </Card>
    </div>
  );
}
