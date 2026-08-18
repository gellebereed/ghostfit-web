/**
 * GhostFit — Legacy Plan Enrichment
 *
 * Plans generated before the program engine have no warm-up, no cool-down and
 * no rest prescription. Rather than force everyone to regenerate, we infer
 * what the session trains — first by matching the exercise name against the
 * library, then by keyword, then by the day's focus — and attach the missing
 * pieces on read.
 */
import { identifyExercise, type ExerciseIdentity } from './exercise-identity';
import { buildCooldown, buildRestDayFlow, buildWarmup } from './mobility-library';
import type { Exercise, MovementPattern, MuscleGroup, WorkoutDay, WorkoutPlan } from './types';

const FOCUS_HINTS: Array<{ match: RegExp; patterns: MovementPattern[]; muscles: MuscleGroup[] }> = [
  { match: /push/i, patterns: ['horizontal_push', 'vertical_push'], muscles: ['chest', 'shoulders', 'triceps'] },
  { match: /pull/i, patterns: ['vertical_pull', 'horizontal_pull'], muscles: ['lats', 'back', 'biceps'] },
  { match: /leg|lower/i, patterns: ['squat', 'hinge', 'lunge'], muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { match: /upper/i, patterns: ['horizontal_push', 'horizontal_pull'], muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
  { match: /core|abs/i, patterns: ['core_anti_extension'], muscles: ['core', 'obliques'] },
  { match: /cardio|conditioning|endurance/i, patterns: ['conditioning'], muscles: ['heart', 'quads', 'calves'] },
];

/** Default rest by block feel, used when the plan predates rest prescriptions. */
function inferRest(exercise: Exercise, pattern: MovementPattern): number {
  if (exercise.metricType === 'cardio') return 0;
  const heavy: MovementPattern[] = ['squat', 'hinge', 'horizontal_push', 'vertical_push', 'vertical_pull', 'horizontal_pull'];
  if (heavy.includes(pattern)) return (exercise.reps ?? 10) <= 6 ? 150 : 105;
  if (pattern.startsWith('core')) return 45;
  return 60;
}

function enrichDay(day: WorkoutDay, equipment: string[], sessionMinutes: number): WorkoutDay {
  if (day.isRest) {
    return {
      ...day,
      sessionType: day.sessionType ?? 'rest',
      warmup: day.warmup?.length ? day.warmup : [],
      cooldown: day.cooldown?.length ? day.cooldown : buildRestDayFlow(),
      intensityLabel: day.intensityLabel ?? 'Light',
      estimatedMinutes: day.estimatedMinutes ?? 12,
      coachNote: day.coachNote ?? 'Recovery day. Sleep, protein and an easy walk do more for your results right now than another session would.',
    };
  }

  const patterns: MovementPattern[] = [];
  const muscles: MuscleGroup[] = [];

  const exercises = day.exercises.map(exercise => {
    const inference: ExerciseIdentity | null = identifyExercise(exercise);
    if (!inference) return exercise;

    if (!patterns.includes(inference.pattern)) patterns.push(inference.pattern);
    [...inference.primary, ...inference.secondary].forEach(m => {
      if (!muscles.includes(m)) muscles.push(m);
    });

    return {
      ...exercise,
      // Stamping the library id is what lets the ghost recognise this lift
      // again after a mesocycle rotates the variation.
      libraryId: exercise.libraryId ?? inference.libraryId,
      movementPattern: exercise.movementPattern ?? inference.pattern,
      primaryMuscles: exercise.primaryMuscles ?? inference.primary,
      secondaryMuscles: exercise.secondaryMuscles ?? inference.secondary,
      coachNote: exercise.coachNote ?? inference.cue,
      restSeconds: exercise.restSeconds ?? inferRest(exercise, inference.pattern),
    };
  });

  // Nothing recognised — fall back to what the day says it is.
  if (patterns.length === 0) {
    const focusHint = FOCUS_HINTS.find(h => h.match.test(day.focus ?? ''));
    if (focusHint) {
      patterns.push(...focusHint.patterns);
      muscles.push(...focusHint.muscles);
    } else {
      patterns.push('squat', 'horizontal_push', 'horizontal_pull');
      muscles.push('quads', 'glutes', 'chest', 'back');
    }
  }

  return {
    ...day,
    exercises,
    sessionType: day.sessionType ?? (patterns.every(p => p === 'conditioning') ? 'conditioning' : 'strength'),
    targetMuscles: day.targetMuscles ?? muscles,
    warmup: day.warmup?.length ? day.warmup : buildWarmup(patterns, equipment, sessionMinutes, exercises[0]?.name),
    cooldown: day.cooldown?.length ? day.cooldown : buildCooldown(muscles, sessionMinutes),
    estimatedMinutes: day.estimatedMinutes ?? Math.max(20, exercises.length * 7 + 12),
    intensityLabel: day.intensityLabel ?? 'Moderate',
  };
}

/**
 * Attach warm-ups, cool-downs and rest prescriptions to any plan that lacks
 * them. Plans already built by the engine pass through untouched.
 */
export function enrichPlan(plan: WorkoutPlan, equipment: string[], sessionMinutes = 45): WorkoutPlan {
  const needsWork = plan.days.some(d => !d.cooldown?.length || (!d.isRest && !d.warmup?.length));
  if (!needsWork) return plan;
  return { ...plan, days: plan.days.map(day => enrichDay(day, equipment, sessionMinutes)) };
}
