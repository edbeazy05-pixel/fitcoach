// Muscle names must match exercises.primary_muscle in the database.
export type DayTemplate = { label: string; target_muscles: string[] };

const LEGS = ['quadriceps', 'hamstrings', 'glutes', 'calves'];

export const SPLIT_TEMPLATES: Record<string, DayTemplate[]> = {
  'Push / Pull / Legs': [
    { label: 'Push', target_muscles: ['chest', 'shoulders', 'triceps'] },
    { label: 'Pull', target_muscles: ['lats', 'middle back', 'biceps', 'traps'] },
    { label: 'Legs', target_muscles: LEGS },
  ],
  'Upper / Lower': [
    { label: 'Upper', target_muscles: ['chest', 'lats', 'middle back', 'shoulders', 'biceps', 'triceps'] },
    { label: 'Lower', target_muscles: [...LEGS, 'lower back'] },
  ],
  'Full body': [
    {
      label: 'Full body',
      target_muscles: ['chest', 'lats', 'middle back', 'quadriceps', 'hamstrings', 'glutes', 'shoulders'],
    },
  ],
  'Bro split': [
    { label: 'Chest', target_muscles: ['chest', 'triceps'] },
    { label: 'Back', target_muscles: ['lats', 'middle back', 'traps', 'biceps'] },
    { label: 'Shoulders', target_muscles: ['shoulders', 'traps', 'forearms'] },
    { label: 'Legs', target_muscles: LEGS },
    { label: 'Arms', target_muscles: ['biceps', 'triceps', 'forearms'] },
  ],
};

export const EQUIPMENT_OPTIONS = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'body only',
  'kettlebells',
  'bands',
  'e-z curl bar',
];
