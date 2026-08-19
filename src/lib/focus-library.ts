/**
 * GhostFit — Focus Areas
 *
 * A specialization block bolted onto the normal program. The split still
 * decides what the session is; the focus block adds dedicated work for one
 * body part the user cares about most, on the sessions where it fits.
 *
 * Two principles keep this from becoming junk volume:
 *
 * 1. **Roles, not favourites.** Each area lists complementary roles and takes
 *    at most one exercise from each. Three variations of the same movement is
 *    the mistake people make when they specialize on their own — it feels like
 *    more work while training the same fibres in the same range.
 *
 * 2. **Loadable first.** Candidates inside a role are ranked so the version
 *    that can be progressively loaded wins whenever the equipment is there.
 *    A muscle grows because the demand on it rises; a movement you cannot add
 *    resistance to stops driving that within weeks.
 */
import type { MuscleGroup } from './types';

export type FocusAreaId = 'abs' | 'glutes' | 'arms' | 'shoulders' | 'back' | 'chest' | 'calves';

/**
 * How often the focus block is added.
 *
 * `every` is offered because users ask for it, not because it is optimal —
 * see FOCUS_FREQUENCY_META for what the UI tells them.
 */
export type FocusFrequency = 'light' | 'standard' | 'every';

export interface FocusRole {
  /** Why this role exists — surfaced in the plan so the block is explainable. */
  label: string;
  /**
   * Library ids, best first. The engine takes the first the user can equip,
   * so ordering encodes the evidence ranking.
   */
  candidates: string[];
  /** Included on every focus session rather than rotated in. */
  core?: boolean;
}

export interface FocusArea {
  id: FocusAreaId;
  label: string;
  emoji: string;
  /** Muscles this area trains — used for the volume audit and cool-down. */
  muscles: MuscleGroup[];
  /** One-line answer to "why these exercises?". */
  rationale: string;
  /** The honest caveat. Shown with the picker, not buried. */
  reality: string;
  roles: FocusRole[];
}

export const FOCUS_AREAS: Record<FocusAreaId, FocusArea> = {
  abs: {
    id: 'abs',
    label: 'Abs & Core',
    emoji: '🎯',
    muscles: ['core', 'obliques'],
    rationale:
      'Loaded spinal flexion plus a bottom-up leg raise, because the crunch family and the raise family bias different ends of the same muscle. An anti-rotation movement rotates in — it is the piece most ab routines skip entirely.',
    reality:
      'This builds the muscle. Whether it shows is decided by body fat, which is a kitchen problem, not a rep problem.',
    roles: [
      {
        label: 'Loaded flexion',
        core: true,
        // Cable crunch first: the only one here that loads in small increments
        // for years. Bodyweight crunches stop being a stimulus quickly.
        candidates: ['cable-crunch', 'weighted-decline-crunch', 'weighted-floor-crunch', 'reverse-crunch'],
      },
      {
        label: 'Bottom-up raise',
        core: true,
        candidates: ['hanging-leg-raise', 'captains-chair-leg-raise', 'hanging-knee-raise', 'lying-leg-raise', 'reverse-crunch'],
      },
      {
        label: 'Anti-rotation / anti-extension',
        candidates: ['ab-wheel', 'cable-pallof-press', 'cable-woodchop', 'pallof-press', 'side-plank'],
      },
    ],
  },

  glutes: {
    id: 'glutes',
    label: 'Glutes',
    emoji: '🍑',
    muscles: ['glutes', 'hamstrings'],
    rationale: 'A loaded hip extension for the top-end contraction, plus single-leg work where the glute medius actually gets asked to do something.',
    reality: 'Glutes recover fast but they are a big muscle — they need real load, not just band work.',
    roles: [
      { label: 'Loaded hip extension', core: true, candidates: ['db-hip-thrust', 'cable-pull-through', 'single-leg-glute-bridge', 'glute-bridge'] },
      { label: 'Single-leg', core: true, candidates: ['db-bulgarian-split-squat', 'db-step-up', 'reverse-lunge'] },
      { label: 'Abduction / finisher', candidates: ['cable-pull-through', 'single-leg-glute-bridge', 'glute-bridge'] },
    ],
  },

  arms: {
    id: 'arms',
    label: 'Arms',
    emoji: '💪',
    muscles: ['biceps', 'triceps', 'forearms'],
    rationale: 'Biceps and triceps in the same block, because arms respond to frequency and both sit out most compound work as junior partners.',
    reality: 'Arms are small muscles. They grow off total weekly sets, and your pressing and pulling already contribute — this adds to that, it does not replace it.',
    roles: [
      { label: 'Biceps', core: true, candidates: ['ez-curl', 'cable-curl', 'db-curl', 'band-curl'] },
      { label: 'Triceps', core: true, candidates: ['db-overhead-triceps', 'db-skullcrusher', 'cable-pushdown', 'band-pushdown', 'bench-dip'] },
      { label: 'Second angle', candidates: ['db-hammer-curl', 'cable-pushdown', 'diamond-pushup'] },
    ],
  },

  shoulders: {
    id: 'shoulders',
    label: 'Shoulders',
    emoji: '🏔️',
    muscles: ['shoulders', 'rear_delts', 'traps'],
    rationale: 'Side and rear delts, which is where shoulder width actually comes from — the front delt is already hammered by every press you do.',
    reality: 'Go lighter than instinct says. Side and rear delts respond to controlled reps, not swung ones.',
    roles: [
      { label: 'Side delt', core: true, candidates: ['db-lateral-raise', 'band-lateral-raise'] },
      { label: 'Rear delt', core: true, candidates: ['cable-face-pull', 'db-rear-delt-fly', 'prone-swimmer'] },
      { label: 'Overhead / traps', candidates: ['db-shoulder-press', 'db-arnold-press'] },
    ],
  },

  back: {
    id: 'back',
    label: 'Back Width',
    emoji: '🦅',
    muscles: ['lats', 'back', 'rear_delts'],
    rationale: 'A vertical pull for width and a horizontal pull for thickness — the two jobs the back has, trained in the same block.',
    reality: 'Pull with the elbows, not the hands. Back work is the easiest to turn accidentally into arm work.',
    roles: [
      { label: 'Vertical pull', core: true, candidates: ['cable-lat-pulldown', 'pullup', 'chinup', 'db-pullover'] },
      { label: 'Horizontal pull', core: true, candidates: ['cable-row', 'db-chest-supported-row', 'db-row', 'inverted-row'] },
      { label: 'Rear delt / detail', candidates: ['cable-face-pull', 'db-pullover', 'db-rear-delt-fly'] },
    ],
  },

  chest: {
    id: 'chest',
    label: 'Chest',
    emoji: '🛡️',
    muscles: ['chest', 'triceps'],
    rationale: 'An incline press for the upper chest most people lag in, plus a fly to load the stretched position a press cannot reach.',
    reality: 'Chest takes real recovery. If your pressing lifts stall, this block is the first thing to cut back.',
    roles: [
      { label: 'Incline press', core: true, candidates: ['db-incline-press', 'cable-chest-press', 'band-chest-press', 'pushup'] },
      { label: 'Stretch / fly', core: true, candidates: ['cable-fly', 'db-fly'] },
      { label: 'Volume finisher', candidates: ['pushup', 'dip'] },
    ],
  },

  calves: {
    id: 'calves',
    label: 'Calves',
    emoji: '🐄',
    muscles: ['calves'],
    rationale: 'Straight-leg and bent-leg raises, because the two calf muscles are trained by different knee angles and most people only ever do one.',
    reality: 'Calves need a full stretch at the bottom and a genuine pause at the top. Bouncing does nothing.',
    roles: [
      { label: 'Straight-leg raise', core: true, candidates: ['db-calf-raise', 'bw-calf-raise'] },
      { label: 'Second angle', candidates: ['single-leg-calf-raise', 'bw-calf-raise'] },
    ],
  },
};

export const FOCUS_AREA_LIST: FocusArea[] = Object.values(FOCUS_AREAS);

export const FOCUS_FREQUENCY_META: Record<FocusFrequency, {
  label: string;
  /** Cap on focus sessions per week. */
  maxSessions: number;
  /** Exercises taken from the role list per session. */
  exercisesPerSession: number;
  blurb: string;
}> = {
  light: {
    label: 'Light',
    maxSessions: 2,
    exercisesPerSession: 2,
    blurb: 'Two sessions a week. Enough to make progress without eating into recovery from your main lifts.',
  },
  standard: {
    label: 'Standard',
    maxSessions: 3,
    // Three slots covers every role the area defines, which is the whole point
    // of the standard tier — light gets the two that matter most.
    exercisesPerSession: 3,
    blurb: 'Three sessions a week with a day between them. This is the sweet spot the evidence supports for a lagging body part.',
  },
  every: {
    label: 'Every session',
    maxSessions: 6,
    exercisesPerSession: 2,
    blurb: 'Added to every training day. More than most people recover from — the engine drops the sets per session to compensate, but back off if your main lifts start stalling.',
  },
};

export const DEFAULT_FOCUS_FREQUENCY: FocusFrequency = 'standard';

export function getFocusArea(id: string | null | undefined): FocusArea | null {
  if (!id) return null;
  return FOCUS_AREAS[id as FocusAreaId] ?? null;
}

export function normalizeFocusFrequency(value: unknown): FocusFrequency {
  return value === 'light' || value === 'every' ? value : DEFAULT_FOCUS_FREQUENCY;
}
