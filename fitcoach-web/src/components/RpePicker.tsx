'use client';

export const RPE_HINT: Record<number, string> = {
  1: 'Very light',
  2: 'Very light',
  3: 'Light',
  4: 'Moderate',
  5: 'Moderate',
  6: 'Somewhat hard',
  7: 'Hard, a few reps left in the tank',
  8: 'Very hard, about 2 reps left',
  9: 'Almost max, 1 rep left',
  10: 'All-out',
};

export const RUN_RPE_HINT: Record<number, string> = {
  1: 'Very easy, like a walk',
  2: 'Very easy, chatting is effortless',
  3: 'Easy, full sentences',
  4: 'Easy, steady',
  5: 'Moderate, short sentences',
  6: 'Comfortably hard',
  7: 'Hard, a few words at a time',
  8: 'Very hard, tempo or threshold effort',
  9: 'Near max, hard to hold for long',
  10: 'All-out',
};

export function RpePicker({
  value,
  onChange,
  hints = RPE_HINT,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  hints?: Record<number, string>;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange(value === n ? null : n)}
            className={`rounded-lg py-2.5 text-sm font-semibold ${
              value === n ? 'bg-blue-600 text-white' : 'bg-stone-100 dark:bg-stone-800'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-500">{value ? `${value}: ${hints[value]}` : '1 = very easy, 10 = all-out. Tap again to clear.'}</p>
    </div>
  );
}
