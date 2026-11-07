'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800 ${className}`}>
    {children}
  </div>
);

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' };

export function Button({ variant = 'primary', className = '', ...props }: BtnProps) {
  const styles = {
    primary: 'bg-blue-600 text-white active:bg-blue-700 disabled:bg-blue-300',
    ghost: 'bg-stone-100 text-stone-800 active:bg-stone-200 dark:bg-stone-800 dark:text-stone-100',
    danger: 'bg-red-50 text-red-700 active:bg-red-100 dark:bg-red-950 dark:text-red-300',
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${styles} ${className}`}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base dark:border-stone-700 dark:bg-stone-950 ${props.className ?? ''}`}
    />
  );
}

export const PageTitle = ({ children }: { children: ReactNode }) => (
  <h1 className="mb-4 text-2xl font-bold tracking-tight">{children}</h1>
);

export const ErrorText = ({ children }: { children: ReactNode }) =>
  children ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{children}</p> : null;
