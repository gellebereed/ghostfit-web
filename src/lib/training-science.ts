/**
 * GhostFit — Training Science
 *
 * The rules the program engine obeys. Everything here is a pure function or a
 * constant so the same inputs always produce the same week, on any device,
 * with no network call.
 *
 * The evidence this encodes, in one paragraph: hypertrophy tracks weekly hard
 * sets per muscle (roughly 10–20 for most people), strength tracks intensity
 * and total quality reps near a heavy load, and both need proximity to failure
 * — expressed here as Reps In Reserve. Each muscle responds better to two
 * exposures a week than one, which is why the splits below repeat patterns
 * rather than hitting a muscle once. Volume climbs across a mesocycle and then
 * drops for a deload week, because fatigue accumulates faster than fitness and
 * the adaptation lands during the easy week. Rest between sets is prescribed,
 * not guessed: heavy compounds need 2–3 minutes to restore force output, while
 * isolation work recovers in under a minute.
 */
import type {
  ExerciseBlock, ExperienceLevel, MovementPattern, MuscleGroup, TrainingPhase,
} from './types';

export const ENGINE_VERSION = 2;

// ─── Goal prescriptions ──────────────────────────────────────────────────────

export interface BlockPrescription {
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  /** Reps left in the tank on the last set. */
  rir: number;
  tempo: string;
}

export interface GoalProfile {
  id: string;
  label: string;
  summary: string;
  blocks: Record<ExerciseBlock, BlockPrescription>;
  /** Dedicated conditioning slots per week (on top of any finishers). */
  conditioningSessions: number;
  conditioningSeconds: number;
  /** Weekly hard-set target per major muscle group — the volume audit. */
  weeklySetTarget: number;
  /** Pair accessories back-to-back to save time and raise density. */
  supersetAccessories: boolean;
}

const GOAL_PROFILES: Record<string, GoalProfile> = {
  strength: {
    id: 'strength',
    label: 'Get Stronger',
    summary: 'Heavy compounds, long rests, low reps. Force production is the target.',
    blocks: {
      primary:      { sets: 5, repMin: 3, repMax: 5,  restSeconds: 180, rir: 2, tempo: '3-1-X-0' },
      secondary:    { sets: 4, repMin: 5, repMax: 8,  restSeconds: 150, rir: 2, tempo: '3-0-1-0' },
      accessory:    { sets: 3, repMin: 8, repMax: 12, restSeconds: 90,  rir: 2, tempo: '2-0-1-0' },
      core:         { sets: 3, repMin: 8, repMax: 12, restSeconds: 60,  rir: 2, tempo: '2-1-1-0' },
      conditioning: { sets: 1, repMin: 0, repMax: 0,  restSeconds: 60,  rir: 3, tempo: '' },
      finisher:     { sets: 2, repMin: 12, repMax: 20, restSeconds: 45, rir: 1, tempo: '' },
    },
    conditioningSessions: 0,
    conditioningSeconds: 900,
    weeklySetTarget: 12,
    supersetAccessories: false,
  },
  muscle: {
    id: 'muscle',
    label: 'Build Muscle',
    summary: 'Moderate loads, controlled tempo, volume that climbs week to week.',
    blocks: {
      primary:      { sets: 4, repMin: 6,  repMax: 10, restSeconds: 150, rir: 2, tempo: '3-0-1-0' },
      secondary:    { sets: 4, repMin: 8,  repMax: 12, restSeconds: 105, rir: 1, tempo: '3-0-1-0' },
      accessory:    { sets: 3, repMin: 10, repMax: 15, restSeconds: 75,  rir: 1, tempo: '2-1-1-0' },
      core:         { sets: 3, repMin: 10, repMax: 15, restSeconds: 60,  rir: 1, tempo: '2-1-1-0' },
      conditioning: { sets: 1, repMin: 0,  repMax: 0,  restSeconds: 60,  rir: 3, tempo: '' },
      finisher:     { sets: 2, repMin: 15, repMax: 20, restSeconds: 45,  rir: 0, tempo: '' },
    },
    conditioningSessions: 1,
    conditioningSeconds: 900,
    weeklySetTarget: 16,
    supersetAccessories: false,
  },
  shredded: {
    id: 'shredded',
    label: 'Get Shredded',
    summary: 'Density over load. Short rests, paired accessories, real conditioning.',
    blocks: {
      primary:      { sets: 4, repMin: 8,  repMax: 12, restSeconds: 90, rir: 2, tempo: '2-0-1-0' },
      secondary:    { sets: 3, repMin: 10, repMax: 15, restSeconds: 60, rir: 1, tempo: '2-0-1-0' },
      accessory:    { sets: 3, repMin: 12, repMax: 20, restSeconds: 45, rir: 1, tempo: '2-0-1-0' },
      core:         { sets: 3, repMin: 15, repMax: 20, restSeconds: 40, rir: 1, tempo: '2-0-1-0' },
      conditioning: { sets: 1, repMin: 0,  repMax: 0,  restSeconds: 60, rir: 3, tempo: '' },
      finisher:     { sets: 3, repMin: 15, repMax: 25, restSeconds: 30, rir: 0, tempo: '' },
    },
    conditioningSessions: 2,
    conditioningSeconds: 1200,
    weeklySetTarget: 14,
    supersetAccessories: true,
  },
  fitness: {
    id: 'fitness',
    label: 'Improve Fitness',
    summary: 'Balanced strength and cardio. Sustainable, joint-friendly, repeatable.',
    blocks: {
      primary:      { sets: 3, repMin: 8,  repMax: 12, restSeconds: 90, rir: 2, tempo: '2-0-1-0' },
      secondary:    { sets: 3, repMin: 10, repMax: 15, restSeconds: 75, rir: 2, tempo: '2-0-1-0' },
      accessory:    { sets: 3, repMin: 12, repMax: 15, restSeconds: 60, rir: 2, tempo: '2-0-1-0' },
      core:         { sets: 3, repMin: 12, repMax: 20, restSeconds: 45, rir: 2, tempo: '2-1-1-0' },
      conditioning: { sets: 1, repMin: 0,  repMax: 0,  restSeconds: 60, rir: 3, tempo: '' },
      finisher:     { sets: 2, repMin: 15, repMax: 20, restSeconds: 45, rir: 1, tempo: '' },
    },
    conditioningSessions: 2,
    conditioningSeconds: 1200,
    weeklySetTarget: 12,
    supersetAccessories: false,
  },
};

export function getGoalProfile(goal: string): GoalProfile {
  const key = (goal || 'fitness').toLowerCase();
  return (
    GOAL_PROFILES[key] ??
    GOAL_PROFILES[
      key.includes('strong') ? 'strength'
      : key.includes('muscle') ? 'muscle'
      : key.includes('shred') || key.includes('fat') || key.includes('lean') ? 'shredded'
      : 'fitness'
    ]
  );
}

// ─── Experience modifiers ────────────────────────────────────────────────────

export interface ExperienceProfile {
  /** Scales every block's set count. Beginners grow on less. */
  volumeScale: number;
  /** Added to every RIR target — novices stay further from failure. */
  rirOffset: number;
  /** Exercises per session ceiling. */
  maxExercises: number;
  /** Advanced trainees tolerate more systemically expensive lifts per session. */
  maxTaxing: number;
  mesocycleLength: number;
}

const EXPERIENCE_PROFILES: Record<ExperienceLevel, ExperienceProfile> = {
  beginner:     { volumeScale: 0.85, rirOffset: 1,  maxExercises: 6, maxTaxing: 1, mesocycleLength: 4 },
  intermediate: { volumeScale: 1.0,  rirOffset: 0,  maxExercises: 7, maxTaxing: 2, mesocycleLength: 4 },
  advanced:     { volumeScale: 1.15, rirOffset: -1, maxExercises: 8, maxTaxing: 3, mesocycleLength: 4 },
};

/**
 * Set floors per block. Volume scaling must never take a compound below three
 * working sets — two sets of a main lift is not enough stimulus to justify the
 * warm-up it needed.
 */
export function minimumSets(block: ExerciseBlock, isDeload: boolean): number {
  if (isDeload) return 2;
  return block === 'primary' || block === 'secondary' ? 3 : 2;
}

export function getExperienceProfile(level: string): ExperienceProfile {
  return EXPERIENCE_PROFILES[(level as ExperienceLevel)] ?? EXPERIENCE_PROFILES.beginner;
}

export function normalizeExperience(level: string | undefined): ExperienceLevel {
  return level === 'intermediate' || level === 'advanced' ? level : 'beginner';
}

// ─── Periodization ───────────────────────────────────────────────────────────

export interface PeriodizationState {
  mesocycleWeek: number;
  mesocycleLength: number;
  phase: TrainingPhase;
  isDeload: boolean;
  volumeMultiplier: number;
  intensityMultiplier: number;
  rirOffset: number;
  note: string;
}

/**
 * Where this week sits in the mesocycle. Volume ramps for three weeks, then a
 * deload week lets the accumulated fatigue drain so the adaptation shows up.
 */
export function periodize(
  programWeek: number,
  experience: ExperienceLevel,
  override?: { phase?: TrainingPhase },
): PeriodizationState {
  const { mesocycleLength } = getExperienceProfile(experience);
  const week = Math.max(1, Math.floor(programWeek));
  const position = ((week - 1) % mesocycleLength) + 1;
  const isDeload = position === mesocycleLength;

  if (override?.phase === 'reentry') {
    return {
      mesocycleWeek: position, mesocycleLength, phase: 'reentry', isDeload: false,
      volumeMultiplier: 0.6, intensityMultiplier: 0.8, rirOffset: 2,
      note: 'Re-entry week — deliberately easy. Soreness now costs you next week.',
    };
  }

  if (isDeload) {
    return {
      mesocycleWeek: position, mesocycleLength, phase: 'deload', isDeload: true,
      volumeMultiplier: 0.55, intensityMultiplier: 0.85, rirOffset: 3,
      note: 'Deload week. Half the sets, same movements. This is where you actually grow.',
    };
  }

  if (week === 1) {
    return {
      mesocycleWeek: position, mesocycleLength, phase: 'foundation', isDeload: false,
      volumeMultiplier: 0.9, intensityMultiplier: 0.9, rirOffset: 1,
      note: 'Week one is a rehearsal. Nail the movement, log the numbers, stay two reps shy of failure.',
    };
  }

  const ramp = position - 1;                 // 1 or 2 inside a 4-week block
  const phase: TrainingPhase = position >= mesocycleLength - 1 ? 'intensification' : 'accumulation';
  return {
    mesocycleWeek: position,
    mesocycleLength,
    phase,
    isDeload: false,
    volumeMultiplier: 1 + ramp * 0.08,
    intensityMultiplier: 1 + ramp * 0.025,
    rirOffset: phase === 'intensification' ? -1 : 0,
    note: phase === 'intensification'
      ? 'Intensification. Volume holds, load climbs. Last set should feel like one rep left.'
      : 'Accumulation. Add a set or a rep everywhere you can hold form.',
  };
}

// ─── Splits ──────────────────────────────────────────────────────────────────

export interface Slot {
  pattern: MovementPattern;
  block: ExerciseBlock;
  /** Narrow the pick inside a pattern (biceps vs triceps on arm work). */
  muscle?: MuscleGroup;
  /** 1 = never dropped. Higher numbers are trimmed first when time is short. */
  priority: number;
}

export interface SessionTemplate {
  key: string;
  name: string;
  focus: string;
  intensityLabel: 'Heavy' | 'Moderate' | 'Light';
  sessionType: 'strength' | 'conditioning' | 'active_recovery';
  slots: Slot[];
}

const S = (pattern: MovementPattern, block: ExerciseBlock, priority: number, muscle?: MuscleGroup): Slot =>
  ({ pattern, block, priority, muscle });

export const SESSION_TEMPLATES: Record<string, SessionTemplate> = {
  full_body_a: {
    key: 'full_body_a', name: 'Full Body A', focus: 'Full Body', intensityLabel: 'Heavy', sessionType: 'strength',
    slots: [
      S('squat', 'primary', 1),
      S('horizontal_push', 'secondary', 1),
      S('horizontal_pull', 'secondary', 1),
      S('hinge', 'accessory', 2),
      S('core_anti_extension', 'core', 2),
      S('isolation_arm', 'accessory', 3, 'biceps'),
    ],
  },
  full_body_b: {
    key: 'full_body_b', name: 'Full Body B', focus: 'Full Body', intensityLabel: 'Moderate', sessionType: 'strength',
    slots: [
      S('hinge', 'primary', 1),
      S('vertical_push', 'secondary', 1),
      S('vertical_pull', 'secondary', 1),
      S('lunge', 'accessory', 2),
      S('core_anti_rotation', 'core', 2),
      S('isolation_arm', 'accessory', 3, 'triceps'),
    ],
  },
  full_body_c: {
    key: 'full_body_c', name: 'Full Body C', focus: 'Full Body', intensityLabel: 'Moderate', sessionType: 'strength',
    slots: [
      S('lunge', 'primary', 1),
      S('horizontal_push', 'secondary', 1),
      S('horizontal_pull', 'secondary', 1),
      S('isolation_shoulder', 'accessory', 2),
      S('core_flexion', 'core', 2),
      S('calf', 'accessory', 3),
    ],
  },
  upper: {
    key: 'upper', name: 'Upper Body', focus: 'Upper Body', intensityLabel: 'Heavy', sessionType: 'strength',
    slots: [
      S('horizontal_push', 'primary', 1),
      S('horizontal_pull', 'primary', 1),
      S('vertical_push', 'secondary', 1),
      S('vertical_pull', 'secondary', 1),
      S('isolation_shoulder', 'accessory', 2),
      S('isolation_arm', 'accessory', 2, 'biceps'),
      S('isolation_arm', 'accessory', 3, 'triceps'),
      S('core_anti_extension', 'core', 3),
    ],
  },
  lower: {
    key: 'lower', name: 'Lower Body', focus: 'Lower Body', intensityLabel: 'Heavy', sessionType: 'strength',
    slots: [
      S('squat', 'primary', 1),
      S('hinge', 'primary', 1),
      S('lunge', 'secondary', 1),
      S('isolation_leg', 'accessory', 2),
      S('calf', 'accessory', 2),
      S('core_anti_rotation', 'core', 3),
    ],
  },
  push: {
    key: 'push', name: 'Upper Body Push', focus: 'Push', intensityLabel: 'Heavy', sessionType: 'strength',
    slots: [
      S('horizontal_push', 'primary', 1),
      S('vertical_push', 'secondary', 1),
      S('horizontal_push', 'accessory', 2),
      S('isolation_shoulder', 'accessory', 2),
      S('isolation_arm', 'accessory', 2, 'triceps'),
      S('core_anti_extension', 'core', 3),
    ],
  },
  pull: {
    key: 'pull', name: 'Upper Body Pull', focus: 'Pull', intensityLabel: 'Heavy', sessionType: 'strength',
    slots: [
      S('vertical_pull', 'primary', 1),
      S('horizontal_pull', 'primary', 1),
      S('horizontal_pull', 'accessory', 2),
      S('isolation_shoulder', 'accessory', 2, 'rear_delts'),
      S('isolation_arm', 'accessory', 2, 'biceps'),
      S('core_flexion', 'core', 3),
    ],
  },
  legs: {
    key: 'legs', name: 'Lower Body', focus: 'Legs', intensityLabel: 'Heavy', sessionType: 'strength',
    slots: [
      S('squat', 'primary', 1),
      S('hinge', 'primary', 1),
      S('lunge', 'secondary', 2),
      S('isolation_leg', 'accessory', 2),
      S('calf', 'accessory', 2),
      S('core_anti_extension', 'core', 3),
    ],
  },
  conditioning: {
    key: 'conditioning', name: 'Conditioning & Core', focus: 'Cardio', intensityLabel: 'Moderate', sessionType: 'conditioning',
    slots: [
      S('conditioning', 'conditioning', 1),
      S('core_anti_extension', 'core', 1),
      S('core_flexion', 'core', 2),
      S('carry', 'accessory', 3),
    ],
  },
};

export interface SplitTemplate {
  id: string;
  name: string;
  days: number;
  rationale: string;
  /** Session keys in the order they should be performed. */
  sequence: string[];
  /** Index offsets (0-6 from day 1) the sessions land on, best-spaced. */
  spacing: number[];
}

/**
 * Spacing is chosen so no muscle group is loaded on consecutive days and rest
 * lands after the heaviest work — the two placement rules that matter most.
 */
const SPLITS: SplitTemplate[] = [
  {
    id: 'full_body_2', name: 'Full Body ×2', days: 2,
    rationale: 'Two sessions a week means every muscle must be trained every session. Full body twice beats a split you cannot finish.',
    sequence: ['full_body_a', 'full_body_b'], spacing: [0, 3],
  },
  {
    id: 'full_body_3', name: 'Full Body ×3', days: 3,
    rationale: 'Three full-body days hit every muscle three times a week — the fastest route to strength and technique when you are new.',
    sequence: ['full_body_a', 'full_body_b', 'full_body_c'], spacing: [0, 2, 4],
  },
  {
    id: 'ppl_3', name: 'Push / Pull / Legs', days: 3,
    rationale: 'Each session owns one job, so you can push it hard and still recover before that muscle comes round again.',
    sequence: ['push', 'pull', 'legs'], spacing: [0, 2, 4],
  },
  {
    id: 'upper_lower_4', name: 'Upper / Lower ×2', days: 4,
    rationale: 'Every muscle trained twice a week at high quality — the split with the strongest evidence behind it for four days.',
    sequence: ['upper', 'lower', 'upper', 'lower'], spacing: [0, 1, 3, 4],
  },
  {
    id: 'ppl_ul_5', name: 'Push / Pull / Legs + Upper / Lower', days: 5,
    rationale: 'Five days lets each muscle get a dedicated session and a second lighter exposure — more volume without more soreness.',
    sequence: ['push', 'pull', 'legs', 'upper', 'lower'], spacing: [0, 1, 2, 4, 5],
  },
  {
    id: 'ppl_6', name: 'Push / Pull / Legs ×2', days: 6,
    rationale: 'Six days, every muscle twice, sessions short enough to stay sharp. Only worth it once recovery is dialled in.',
    sequence: ['push', 'pull', 'legs', 'push', 'pull', 'legs'], spacing: [0, 1, 2, 4, 5, 6],
  },
];

/**
 * Pick the split that fits the days available and the trainee in front of you.
 * A beginner on three days gets full body, not Push/Pull/Legs — frequency and
 * practice beat specialisation before technique is grooved.
 */
export function selectSplit(trainingDays: number, experience: ExperienceLevel, goal: string): SplitTemplate {
  const days = Math.max(2, Math.min(6, Math.round(trainingDays)));
  const candidates = SPLITS.filter(s => s.days === days);
  if (candidates.length === 0) return SPLITS[1];
  if (candidates.length === 1) return candidates[0];

  // Only the 3-day slot is contested: full body vs PPL.
  if (days === 3) {
    const wantsSpecialisation = experience !== 'beginner' && (goal === 'muscle' || goal === 'shredded');
    return candidates.find(c => (wantsSpecialisation ? c.id === 'ppl_3' : c.id === 'full_body_3'))!;
  }
  return candidates[0];
}

export function getSplitById(id: string): SplitTemplate | undefined {
  return SPLITS.find(s => s.id === id);
}

// ─── Session time budgeting ──────────────────────────────────────────────────

/** Seconds a working set of this kind takes, excluding rest. */
export function workSeconds(repMax: number, tempo: string): number {
  const perRep = tempo
    ? tempo.split('-').reduce((sum, part) => sum + (part === 'X' ? 1 : Number(part) || 0), 0)
    : 3;
  return Math.max(20, repMax * Math.max(2, perRep));
}

export function exerciseSeconds(sets: number, repMax: number, restSeconds: number, tempo: string): number {
  return sets * workSeconds(repMax, tempo) + Math.max(0, sets - 1) * restSeconds;
}

// ─── Progressive overload ────────────────────────────────────────────────────

/**
 * Double progression, stated plainly: hold the load until every set clears the
 * top of the rep range, then add weight and drop back to the bottom.
 */
export function progressionCue(repMin: number, repMax: number, metricType: string): string {
  if (metricType === 'cardio') {
    return 'Beat last week by 30 seconds or by covering more ground in the same time.';
  }
  if (metricType === 'duration') {
    return 'Hold 5 seconds longer than last week before you add difficulty.';
  }
  if (metricType === 'bodyweight_reps' || metricType === 'reps_only') {
    return `Clear ${repMax} on every set, then progress to a harder variation.`;
  }
  return `Hit ${repMax} reps on all sets, then add the smallest possible weight and restart at ${repMin}.`;
}

/**
 * Round an RIR into a range that is both actionable and safe to repeat.
 *
 * The floor of 1 is deliberate: training every prescribed set to true failure
 * generates fatigue far faster than it generates adaptation, and it is the
 * fastest way to turn a five-day program into a three-day one. The ceiling of
 * 3 stops the stacked beginner and deload offsets from prescribing sets so
 * easy they stimulate nothing.
 */
export function clampRir(rir: number): number {
  return Math.max(1, Math.min(3, Math.round(rir)));
}

/** Prescriptions read better — and progress better — on round numbers. */
export function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

// ─── Volume audit ────────────────────────────────────────────────────────────

/** Muscles the weekly volume audit reports on. */
export const AUDITED_MUSCLES: MuscleGroup[] = [
  'chest', 'back', 'lats', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'core', 'calves',
];

export function volumeVerdict(sets: number, target: number): 'low' | 'on_target' | 'high' {
  if (sets < target * 0.6) return 'low';
  if (sets > target * 1.5) return 'high';
  return 'on_target';
}
