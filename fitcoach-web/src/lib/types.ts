export type Profile = {
  id: string;
  display_name: string | null;
  goal: 'strength' | 'size' | 'fat_loss' | 'general' | null;
  experience: 'beginner' | 'intermediate' | 'advanced' | null;
  units: 'lb' | 'kg';
  equipment: string[];
  session_minutes: number;
  timezone: string;
};

export type Exercise = {
  id: string;
  name: string;
  primary_muscle: string;
  equipment: string;
  is_compound: boolean;
};

export type SetRow = {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  is_warmup: boolean;
  completed_at: string;
};

export type WorkoutExercise = {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  exercises: Exercise;
  sets: SetRow[];
};

export type Workout = {
  id: string;
  workout_date: string;
  label: string | null;
  status: 'planned' | 'in_progress' | 'done' | 'skipped';
  source: 'manual' | 'ai';
  started_at: string | null;
  finished_at: string | null;
  ai_rationale: string | null;
};

export type HistoryRow = {
  exercise_id: string;
  workout_date: string;
  set_number: number;
  weight: number;
  reps: number;
};
