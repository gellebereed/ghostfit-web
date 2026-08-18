/**
 * GhostFit — Exercise Identity
 *
 * Answers one question consistently across the app: *which* exercise is this,
 * and what pattern does it belong to?
 *
 * It matters because the mesocycle deliberately rotates variations. Barbell
 * Bench Press becomes Dumbbell Bench Press at the start of a new block, and
 * without a shared identity every rotation would look like a brand-new
 * exercise — resetting the ghost, wiping your momentum, and handing you a
 * "first meeting" on a movement you have been training for months.
 *
 * Resolution order: the fields the engine already stamped on the exercise,
 * then an exact library-name match, then the longest library name contained in
 * the name, then keyword inference. The fallbacks exist because sessions logged
 * before the engine — and exercises the user typed in by hand — carry nothing
 * but a name.
 */
import { EXERCISE_LIBRARY, type LibraryExercise } from './exercise-library';
import type { Exercise, MovementPattern, MuscleGroup } from './types';

export interface ExerciseIdentity {
  /** Library id when we can pin it down. Absent for custom exercises. */
  libraryId?: string;
  pattern: MovementPattern;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  cue?: string;
}

const BY_NAME = new Map<string, LibraryExercise>(
  EXERCISE_LIBRARY.map(e => [normalize(e.name), e]),
);

/**
 * Spacing- and plural-insensitive key.
 *
 * The manual "Add Exercise" list and anything a user types by hand use forms
 * the library does not: "Pushups" for "Push-up", "Squats" for "Bodyweight
 * Squat", "Bicep Curls" for "Dumbbell Curl". Without collapsing hyphens,
 * spaces and trailing plurals, every one of those logs as an unrecognised
 * exercise and the ghost never connects it to anything.
 */
const BY_COMPACT = new Map<string, LibraryExercise>(
  EXERCISE_LIBRARY.map(e => [compact(e.name), e]),
);

export function normalize(value: string): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Punctuation- and spacing-insensitive key. No pluralisation applied. */
function compact(value: string): string {
  return normalize(value).replace(/\s+/g, '');
}

/**
 * Singular candidates for a name, rather than one guess at English.
 *
 * "Crunches" needs -es stripped, "Lateral Raises" needs only -s, and no single
 * rule gets both right. Generating every plausible singular and accepting
 * whichever one matches avoids shipping a pluralisation dictionary.
 */
function nameVariants(value: string): string[] {
  const key = normalize(value);
  const perWord = (fn: (w: string) => string) => key.split(' ').map(fn).join(' ');

  const stripS = perWord(w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
  const stripEs = perWord(w => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w));
  const stripIes = perWord(w => (w.length > 5 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w));

  return [...new Set([key, stripS, stripEs, stripIes])];
}

function compactVariants(value: string): string[] {
  return [...new Set(nameVariants(value).map(v => v.replace(/\s+/g, '')))];
}

/** Keyword → the pattern and muscles that keyword reliably implies. */
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
  // Last resort. Everything more specific — overhead, shoulder, leg press —
  // is matched above, so a bare "press" here is a chest press by elimination.
  { match: /\bpress\b/, pattern: 'horizontal_push', muscles: ['chest', 'triceps', 'shoulders'] },
];

function fromLibrary(lib: LibraryExercise): ExerciseIdentity {
  return { libraryId: lib.id, pattern: lib.pattern, primary: lib.primary, secondary: lib.secondary, cue: lib.cue };
}

/** Resolve by name alone — the only information a legacy session carries. */
export function identifyByName(name: string): ExerciseIdentity | null {
  const key = normalize(name);
  if (!key) return null;

  const exact = BY_NAME.get(key);
  if (exact) return fromLibrary(exact);

  // Same name, different punctuation or plural — "Pushups" is "Push-up".
  const keys = compactVariants(name);
  for (const candidate of keys) {
    const loose = BY_COMPACT.get(candidate);
    if (loose) return fromLibrary(loose);
  }

  // Longest library name contained in the given name wins, so "Incline
  // Dumbbell Bench Press" resolves to the bench press rather than "Press".
  let best: LibraryExercise | null = null;
  let bestLength = 0;
  for (const [libCompact, lib] of BY_COMPACT) {
    if (keys.some(k => k.includes(libCompact)) && libCompact.length > bestLength) {
      best = lib;
      bestLength = libCompact.length;
    }
  }
  if (best) return fromLibrary(best);

  const variants = nameVariants(name);
  const hint = KEYWORD_HINTS.find(h => variants.some(v => h.match.test(v)));
  if (hint) {
    return { pattern: hint.pattern, primary: hint.muscles.slice(0, 2), secondary: hint.muscles.slice(2) };
  }
  return null;
}

/**
 * Resolve a planned exercise. Fields stamped by the engine win — they are
 * authoritative — and everything else falls back to name resolution.
 */
export function identifyExercise(exercise: Exercise): ExerciseIdentity | null {
  if (exercise.libraryId) {
    const lib = EXERCISE_LIBRARY.find(e => e.id === exercise.libraryId);
    if (lib) return fromLibrary(lib);
  }
  if (exercise.movementPattern && exercise.primaryMuscles?.length) {
    return {
      libraryId: exercise.libraryId,
      pattern: exercise.movementPattern,
      primary: exercise.primaryMuscles,
      secondary: exercise.secondaryMuscles ?? [],
      cue: exercise.coachNote,
    };
  }

  const byName = identifyByName(exercise.name);
  if (byName) return byName;

  if (exercise.type === 'cardio' || exercise.metricType === 'cardio') {
    return { pattern: 'conditioning', primary: ['heart'], secondary: ['quads', 'calves'] };
  }
  return null;
}

/**
 * Do two exercises count as the same lift for ghost purposes?
 *
 * Library ids are compared when both have one; otherwise the normalised name
 * is the tiebreaker, which is what pre-engine sessions have to offer.
 */
export function isSameLift(
  a: { libraryId?: string; name: string },
  b: { libraryId?: string; name: string },
): boolean {
  const aId = a.libraryId ?? identifyByName(a.name)?.libraryId;
  const bId = b.libraryId ?? identifyByName(b.name)?.libraryId;
  if (aId && bId) return aId === bId;

  // Neither resolves to the library (a custom exercise) — fall back to names,
  // treating punctuation and plural differences as the same lift.
  const bVariants = compactVariants(b.name);
  return compactVariants(a.name).some(v => bVariants.includes(v));
}

/** Human label for a pattern — used when the ghost explains itself. */
export const PATTERN_LABELS: Record<MovementPattern, string> = {
  horizontal_push: 'horizontal pressing',
  vertical_push: 'overhead pressing',
  horizontal_pull: 'rowing',
  vertical_pull: 'vertical pulling',
  squat: 'squatting',
  hinge: 'hinging',
  lunge: 'single-leg work',
  carry: 'loaded carries',
  core_anti_extension: 'anti-extension core work',
  core_anti_rotation: 'anti-rotation core work',
  core_flexion: 'core flexion work',
  isolation_arm: 'arm work',
  isolation_shoulder: 'shoulder work',
  isolation_leg: 'leg isolation work',
  calf: 'calf work',
  conditioning: 'conditioning',
};
