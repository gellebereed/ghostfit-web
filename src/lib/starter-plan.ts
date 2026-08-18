import { buildProgram } from './program-engine';
import type { WorkoutPlan } from './types';

/**
 * The first week of a new user's program.
 *
 * Kept as a named export because onboarding and older call sites import it,
 * but there is no longer a "starter" plan distinct from a real one — the
 * program engine builds a properly periodised week 1 (foundation phase) with
 * warm-ups, prescribed rest, and cool-down stretching, offline and instantly.
 */
export function createStarterPlan(
  equipment: string[],
  goal: string,
  trainingDays = 3,
  options: { experience?: string; sessionMinutes?: number } = {},
): WorkoutPlan {
  return buildProgram({
    equipment,
    goal,
    trainingDays,
    experience: options.experience ?? 'beginner',
    sessionMinutes: options.sessionMinutes ?? 45,
    programWeek: 1,
  });
}
