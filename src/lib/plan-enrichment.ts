/**
 * GhostFit — Legacy Plan Enrichment
 *
 * Plans generated before the program engine have no warm-up, no cool-down and
 * no rest prescription. Rather than force everyone to regenerate, we infer
 * what the session trains — first by matching the exercise name against the
 * library, then by keyword, then by the day's focus — and attach the missing
 * pieces on read.
 */
import { EXERCISE_LIBRARY, type LibraryExercise } from './exercise-library';
import { buildCooldown, buildRestDayFlow, buildWarmup } from './mobility-library';
import type { Exercise, MovementPattern, MuscleGroup, WorkoutDay, WorkoutPlan } from './types';

const BY_NAME = new Map<string, LibraryExercise>(
  EXERCISE_LIBRARY.map(e => [normalize(e.name), e]),
);

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Keyword → the muscles and pattern that keyword reliably implies. */
const KEYWORD_HINTS: Array<{ match: RegExp; pattern: MovementPattern; muscles: MuscleGroup[] }> = [
  { match: /\b(bench|chest press|push[- ]?up|pushup|chest fly|fly|dip|pec)\b/, pattern: 'horizontal_push', muscles: ['chest', 'triceps', 'shoulders'] },
  { match: /\b(overhead press|shoulder press|military|pike|arnold)\b/, pattern: 'vertical_push', muscles: ['shoulders', 'triceps'] },
  { match: /\b(pull[- ]?up|chin[- ]?up|pulldown|pullover)\b/, pattern: 'vertical_pull', muscles: ['lats', 'biceps', 'back'] },
  { match: /\b(row|inverted|face pull|rear delt|reverse snow)\b/, pattern: 'horizontal_pull', muscles: ['back', 'lats', 'biceps', 'rear_delts'] },
  { match: /\b(squat|leg press|wall sit)\b/, pattern: 'squat', muscles: ['quads', 'glutes'] },
  { match: /\b(deadlift|romanian|rdl|hinge|good morning|swing|hip thrust|glute bridge|back extension)\b/, pattern: 'hinge', muscles: ['hamstrings', 'glutes', 'lower_back'] },
  { match: /\b(lunge|split squat|step[- ]?up|bulgarian)\b/, pattern: 'lunge', muscles: ['quads', 'glutes'] },
  { match: /\b(curl)\b/, pattern: 'isolation_arm', muscles: ['biceps', 'forearms'] },
  { match: /\b(tricep|pushdown|skullcrusher|kickback|extension)\b/, pattern: 'isolation_arm', muscles: ['triceps'] },
  { match: /\b(lateral raise|front raise|upright row|shrug)\b/, pattern: 'isolation_shoulder', muscles: ['shoulders', 'traps'] },
  { match: /\b(calf)\b/, pattern: 'calf', muscles: ['calves'] },
  { match: /\b(leg curl|hamstring curl|nordic)\b/, pattern: 'isolation_leg', muscles: ['hamstrings'] },
  { match: /\b(leg extension)\b/, pattern: 'isolation_leg', muscles: ['quads'] },
  { match: /\b(plank|dead bug|hollow|ab wheel)\b/, pattern: 'core_anti_extension', muscles: ['core'] },
  { match: /\b(side plank|pallof|russian twist|oblique|bird dog)\b/, pattern: 'core_anti_rotation', muscles: ['obliques', 'core'] },
  { match: /\b(crunch|sit[- ]?up|leg raise|knee raise|v[- ]?up)\b/, pattern: 'core_flexion', muscles: ['core', 'hip_flexors'] },
  { match: /\b(carry|farmer|suitcase)\b/, pattern: 'carry', muscles: ['forearms', 'traps', 'core'] },
  { match: /\b(treadmill|run|jog|walk|row(ing)? machine|bike|cycl|elliptical|jump rope|skip|burpee|mountain climber|high knee|jumping jack|slam|sprint)\b/, pattern: 'conditioning', muscles: ['heart'] },
];

const FOCUS_HINTS: Array<{ match: RegExp; patterns: MovementPattern[]; muscles: MuscleGroup[] }> = [
  { match: /push/i, patterns: ['horizontal_push', 'vertical_push'], muscles: ['chest', 'shoulders', 'triceps'] },
  { match: /pull/i, patterns: ['vertical_pull', 'horizontal_pull'], muscles: ['lats', 'back', 'biceps'] },
  { match: /leg|lower/i, patterns: ['squat', 'hinge', 'lunge'], muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { match: /upper/i, patterns: ['horizontal_push', 'horizontal_pull'], muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
  { match: /core|abs/i, patterns: ['core_anti_extension'], muscles: ['core', 'obliques'] },
  { match: /cardio|conditioning|endurance/i, patterns: ['conditioning'], muscles: ['heart', 'quads', 'calves'] },
];

interface Inference {
  pattern: MovementPattern;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  cue?: string;
}

function inferExercise(exercise: Exercise): Inference | null {
  if (exercise.movementPattern && exercise.primaryMuscles?.length) {
    return {
      pattern: exercise.movementPattern,
      primary: exercise.primaryMuscles,
      secondary: exercise.secondaryMuscles ?? [],
      cue: exercise.coachNote,
    };
  }

  const name = normalize(exercise.name);
  const exact = BY_NAME.get(name);
  if (exact) {
    return { pattern: exact.pattern, primary: exact.primary, secondary: exact.secondary, cue: exact.cue };
  }

  // Longest library name fully contained in the exercise name wins.
  let best: LibraryExercise | null = null;
  for (const [libName, lib] of BY_NAME) {
    if (name.includes(libName) && (!best || libName.length > normalize(best.name).length)) best = lib;
  }
  if (best) {
    return { pattern: best.pattern, primary: best.primary, secondary: best.secondary, cue: best.cue };
  }

  const hint = KEYWORD_HINTS.find(h => h.match.test(name));
  if (hint) {
    return { pattern: hint.pattern, primary: hint.muscles.slice(0, 2), secondary: hint.muscles.slice(2) };
  }

  if (exercise.type === 'cardio' || exercise.metricType === 'cardio') {
    return { pattern: 'conditioning', primary: ['heart'], secondary: ['quads', 'calves'] };
  }
  return null;
}

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
    const inference = inferExercise(exercise);
    if (!inference) return exercise;

    if (!patterns.includes(inference.pattern)) patterns.push(inference.pattern);
    [...inference.primary, ...inference.secondary].forEach(m => {
      if (!muscles.includes(m)) muscles.push(m);
    });

    return {
      ...exercise,
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
