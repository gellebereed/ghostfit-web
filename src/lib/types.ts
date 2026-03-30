// GhostFit TypeScript Types

export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  equipment: string;
  type: 'strength' | 'cardio';
  durationSeconds?: number; // for cardio
}

export interface WorkoutDay {
  dayNumber: number;
  dayName: string;
  focus: string;
  isRest: boolean;
  exercises: Exercise[];
}

export interface WorkoutPlan {
  weekNumber: number;
  days: WorkoutDay[];
  createdAt: number;
}

export interface GhostSession {
  id: string;
  exerciseName: string;
  date: number;
  totalReps: number;
  avgWeight: number;
  totalDuration: number; // seconds, for cardio
  setsCompleted: number;
  result: 'win' | 'loss' | 'incomplete';
  characterTier: number;
}

export interface UserProfile {
  equipment: string[];
  goal: string;
  currentWeek: number;
  onboardingComplete: boolean;
  createdAt: number;
}

export interface ExerciseInfo {
  name: string;
  gifUrl: string;
  instructions: string[];
  bodyPart: string;
  youtubeVideoId?: string;
}

// Ghost tier thresholds
export const TIER_THRESHOLDS = [0, 3, 8, 15, 25];

export function calculateTier(totalWins: number): number {
  if (totalWins >= 25) return 5;
  if (totalWins >= 15) return 4;
  if (totalWins >= 8) return 3;
  if (totalWins >= 3) return 2;
  return 1;
}

export function getTierLabel(tier: number): string {
  const labels = ['', 'Rookie', 'Fighter', 'Warrior', 'Champion', 'Legend'];
  return labels[tier] || 'Rookie';
}
