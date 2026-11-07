'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const TABS = [
  { href: '/', label: 'Today' },
  { href: '/plan', label: 'Plan' },
  { href: '/history', label: 'History' },
  { href: '/progress', label: 'Progress' },
  { href: '/profile', label: 'Profile' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login');
      else setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/login');
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!ready) return <div className="p-8 text-center text-stone-500">Loading…</div>;

  // The workout screen runs full-screen, without the tab bar.
  const hideNav = pathname.startsWith('/workout/');

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">
      {children}
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
          <ul className="mx-auto flex max-w-md">
            {TABS.map((t) => {
              const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
              return (
                <li key={t.href} className="flex-1">
                  <Link
                    href={t.href}
                    className={`block py-3 text-center text-xs font-semibold ${active ? 'text-blue-600' : 'text-stone-500'}`}
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
