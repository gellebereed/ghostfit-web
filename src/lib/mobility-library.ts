/**
 * GhostFit — Warm-up & Cool-down Library
 *
 * Warm-ups follow the RAMP protocol (Jeffreys): Raise the core temperature,
 * Mobilise the joints the session will load, Activate the muscles that switch
 * off from sitting, Potentiate with ramp-up sets of the day's first lift.
 *
 * Cool-downs are static holds of 30–45s — the duration where stretching
 * actually shifts range of motion — chosen from the muscles the session
 * trained, plus a downregulation breathing finisher so the nervous system
 * leaves the workout too.
 */
import type { CooldownStep, MovementPattern, MuscleGroup, WarmupStep } from './types';

// ─── Raise: general blood-flow work ──────────────────────────────────────────

interface RaiseOption {
  step: Omit<WarmupStep, 'stage'>;
  /** Requires this equipment; undefined = bodyweight. */
  requires?: string;
}

const RAISE_OPTIONS: RaiseOption[] = [
  { requires: 'Treadmill', step: { id: 'raise-treadmill', name: 'Treadmill Brisk Walk', durationSeconds: 300, reps: null, perSide: false, targets: ['heart'],
    cue: 'Gentle incline, easy pace. You want warm, not tired.' } },
  { requires: 'Rowing Machine', step: { id: 'raise-row', name: 'Easy Row', durationSeconds: 300, reps: null, perSide: false, targets: ['heart', 'back'],
    cue: 'Light resistance, long strokes. Wake the whole chain up.' } },
  { requires: 'Spin Bike', step: { id: 'raise-bike', name: 'Easy Spin', durationSeconds: 300, reps: null, perSide: false, targets: ['heart', 'quads'],
    cue: 'Low resistance, high cadence. Legs should feel loose, not burning.' } },
  { requires: 'Jump Rope', step: { id: 'raise-rope', name: 'Jump Rope', durationSeconds: 180, reps: null, perSide: false, targets: ['heart', 'calves'],
    cue: 'Light bounces. Stop early if the calves start to complain.' } },
  { step: { id: 'raise-march', name: 'March & Arm Swings', durationSeconds: 120, reps: null, perSide: false, targets: ['heart', 'shoulders'],
    cue: 'March on the spot, swing the arms big. Get the breath moving.' } },
  { step: { id: 'raise-jacks', name: 'Jumping Jacks', durationSeconds: 60, reps: null, perSide: false, targets: ['heart', 'shoulders'],
    cue: 'Easy tempo — this is a warm-up, not a set.' } },
];

// ─── Mobilise: joint prep, chosen by the day's movement patterns ─────────────

const MOBILISE: Record<string, Omit<WarmupStep, 'stage'>> = {
  shoulder_cars: { id: 'mob-shoulder-cars', name: 'Shoulder Circles', durationSeconds: 40, reps: 10, perSide: false, targets: ['shoulders'],
    cue: 'Slow, biggest circle you own. Both directions.' },
  wall_slide: { id: 'mob-wall-slide', name: 'Wall Slide', durationSeconds: 40, reps: 10, perSide: false, targets: ['shoulders', 'back'],
    cue: 'Back and wrists on the wall. Slide up without the ribs flaring.' },
  band_pull_apart: { id: 'mob-band-pull-apart', name: 'Band Pull-apart', durationSeconds: 40, reps: 15, perSide: false, targets: ['rear_delts', 'back'],
    cue: 'Straight arms, squeeze the shoulder blades. Preps every pressing rep.' },
  thoracic_rotation: { id: 'mob-t-spine', name: 'Thoracic Rotation', durationSeconds: 45, reps: 8, perSide: true, targets: ['back', 'obliques'],
    cue: 'On all fours, hand behind the head, open the chest to the ceiling.' },
  cat_cow: { id: 'mob-cat-cow', name: 'Cat–Cow', durationSeconds: 40, reps: 10, perSide: false, targets: ['lower_back', 'core'],
    cue: 'Move one vertebra at a time. Breathe with the movement.' },
  hip_circle: { id: 'mob-hip-circle', name: 'Hip Circles', durationSeconds: 40, reps: 8, perSide: true, targets: ['glutes', 'hip_flexors'],
    cue: 'Knee draws the biggest circle it can. Slow beats big.' },
  worlds_greatest: { id: 'mob-wgs', name: "World's Greatest Stretch", durationSeconds: 60, reps: 5, perSide: true, targets: ['hip_flexors', 'hamstrings', 'back'],
    cue: 'Deep lunge, elbow to the instep, then rotate up. Earns its name.' },
  leg_swing: { id: 'mob-leg-swing', name: 'Leg Swings', durationSeconds: 40, reps: 12, perSide: true, targets: ['hamstrings', 'hip_flexors'],
    cue: 'Front to back, then side to side. Controlled, not ballistic.' },
  ankle_rock: { id: 'mob-ankle-rock', name: 'Ankle Rock', durationSeconds: 40, reps: 10, perSide: true, targets: ['calves'],
    cue: 'Half-kneeling, drive the knee past the toes with the heel down.' },
  bodyweight_squat_prep: { id: 'mob-squat-prep', name: 'Deep Squat Hold & Pry', durationSeconds: 45, reps: null, perSide: false, targets: ['quads', 'glutes', 'adductors'],
    cue: 'Sit in the bottom, elbows push the knees out. Rock side to side.' },
  wrist_prep: { id: 'mob-wrist', name: 'Wrist Prep', durationSeconds: 30, reps: null, perSide: false, targets: ['forearms'],
    cue: 'Palms down, rock forward and back. Essential before any push-up work.' },
};

// ─── Activate: switch on what sitting switches off ───────────────────────────

const ACTIVATE: Record<string, Omit<WarmupStep, 'stage'>> = {
  glute_bridge: { id: 'act-glute-bridge', name: 'Glute Bridge', durationSeconds: 40, reps: 15, perSide: false, targets: ['glutes'],
    cue: 'Squeeze hard at the top. Wakes the glutes before they have to work.' },
  monster_walk: { id: 'act-monster-walk', name: 'Banded Lateral Walk', durationSeconds: 40, reps: 12, perSide: true, targets: ['glutes'],
    cue: 'Band above the knees, half-squat, step wide. Knees never cave in.' },
  scap_pushup: { id: 'act-scap-pushup', name: 'Scapular Push-up', durationSeconds: 40, reps: 12, perSide: false, targets: ['back', 'shoulders'],
    cue: 'Arms straight — only the shoulder blades move. Protracts and retracts.' },
  scap_pull: { id: 'act-scap-pull', name: 'Scapular Pull-up', durationSeconds: 40, reps: 8, perSide: false, targets: ['lats', 'back'],
    cue: 'Dead hang, pull the shoulders down without bending the elbows.' },
  dead_bug: { id: 'act-dead-bug', name: 'Dead Bug', durationSeconds: 45, reps: 8, perSide: true, targets: ['core'],
    cue: 'Low back stays flat. Teaches the brace you will need under load.' },
  bird_dog: { id: 'act-bird-dog', name: 'Bird Dog', durationSeconds: 45, reps: 8, perSide: true, targets: ['core', 'lower_back', 'glutes'],
    cue: 'Opposite arm and leg, hips square. Balance a glass on your back.' },
};

/** Which mobilisers and activators each pattern earns. */
const PATTERN_PREP: Record<MovementPattern, { mobilise: string[]; activate: string[] }> = {
  horizontal_push:     { mobilise: ['shoulder_cars', 'wall_slide', 'wrist_prep'], activate: ['scap_pushup'] },
  vertical_push:       { mobilise: ['shoulder_cars', 'wall_slide', 'thoracic_rotation'], activate: ['scap_pushup'] },
  horizontal_pull:     { mobilise: ['band_pull_apart', 'thoracic_rotation'], activate: ['scap_pull'] },
  vertical_pull:       { mobilise: ['band_pull_apart', 'shoulder_cars'], activate: ['scap_pull'] },
  squat:               { mobilise: ['hip_circle', 'ankle_rock', 'bodyweight_squat_prep'], activate: ['glute_bridge', 'monster_walk'] },
  hinge:               { mobilise: ['cat_cow', 'leg_swing', 'worlds_greatest'], activate: ['glute_bridge', 'bird_dog'] },
  lunge:               { mobilise: ['hip_circle', 'worlds_greatest', 'ankle_rock'], activate: ['glute_bridge'] },
  carry:               { mobilise: ['shoulder_cars'], activate: ['dead_bug'] },
  core_anti_extension: { mobilise: ['cat_cow'], activate: ['dead_bug'] },
  core_anti_rotation:  { mobilise: ['cat_cow'], activate: ['bird_dog'] },
  core_flexion:        { mobilise: ['cat_cow'], activate: ['dead_bug'] },
  isolation_arm:       { mobilise: ['wrist_prep'], activate: [] },
  isolation_shoulder:  { mobilise: ['shoulder_cars', 'band_pull_apart'], activate: [] },
  isolation_leg:       { mobilise: ['leg_swing'], activate: ['glute_bridge'] },
  calf:                { mobilise: ['ankle_rock'], activate: [] },
  conditioning:        { mobilise: ['leg_swing', 'hip_circle'], activate: [] },
};

const BAND_ONLY = new Set(['mob-band-pull-apart', 'act-monster-walk']);
const BAR_ONLY = new Set(['act-scap-pull']);

/**
 * Build the RAMP warm-up for a session.
 *
 * @param patterns  movement patterns the session will train, most important first
 * @param equipment what the user owns — gates band/bar-specific drills
 * @param minutes   rough budget; longer sessions earn a longer warm-up
 */
export function buildWarmup(
  patterns: MovementPattern[],
  equipment: string[],
  minutes: number,
  firstLiftName?: string,
): WarmupStep[] {
  const owned = new Set(equipment);
  const allowed = (id: string) =>
    (!BAND_ONLY.has(id) || owned.has('Resistance Bands')) &&
    (!BAR_ONLY.has(id) || owned.has('Pull-up Bar'));

  const steps: WarmupStep[] = [];

  // Raise — first option whose equipment the user actually has.
  const raise = RAISE_OPTIONS.find(o => !o.requires || owned.has(o.requires))!;
  const raiseSeconds = minutes <= 30 ? Math.min(raise.step.durationSeconds, 180) : raise.step.durationSeconds;
  steps.push({ ...raise.step, durationSeconds: raiseSeconds, stage: 'raise' });

  const mobiliseBudget = minutes <= 30 ? 2 : minutes <= 45 ? 3 : 4;
  const activateBudget = minutes <= 30 ? 1 : 2;

  const seen = new Set<string>();
  const pick = (keys: string[], source: Record<string, Omit<WarmupStep, 'stage'>>, stage: WarmupStep['stage'], budget: number) => {
    let taken = 0;
    for (const key of keys) {
      if (taken >= budget) break;
      const step = source[key];
      if (!step || seen.has(step.id) || !allowed(step.id)) continue;
      seen.add(step.id);
      steps.push({ ...step, stage });
      taken++;
    }
    return taken;
  };

  // Interleave patterns so a Push/Pull day preps both, not just the first.
  const mobiliseKeys = interleave(patterns.map(p => PATTERN_PREP[p]?.mobilise ?? []));
  const activateKeys = interleave(patterns.map(p => PATTERN_PREP[p]?.activate ?? []));

  pick(mobiliseKeys, MOBILISE, 'mobilise', mobiliseBudget);
  pick(activateKeys, ACTIVATE, 'activate', activateBudget);

  // Potentiate — ramp-up sets of the day's first working lift.
  if (firstLiftName) {
    steps.push({
      id: 'potentiate-ramp',
      name: `Ramp-up sets — ${firstLiftName}`,
      stage: 'potentiate',
      durationSeconds: 180,
      reps: null,
      perSide: false,
      targets: [],
      cue: 'Two light sets: ~50% then ~75% of your working weight, 5 crisp reps each. Bodyweight? Do half-range reps.',
    });
  }

  return steps;
}

// ─── Cool-down: static stretches per muscle group ────────────────────────────

const STRETCHES: Record<MuscleGroup, Omit<CooldownStep, 'kind' | 'holdSeconds'>[]> = {
  chest: [{ id: 'cd-doorway-chest', name: 'Doorway Chest Stretch', perSide: true, targets: ['chest', 'shoulders'],
    cue: 'Forearm on the frame at shoulder height, step through and turn away.',
    relief: 'Undoes the rounded-shoulder feeling after pressing.' }],
  back: [{ id: 'cd-child-pose', name: "Child's Pose", perSide: false, targets: ['back', 'lats', 'lower_back'],
    cue: 'Knees wide, hips to heels, arms long. Breathe into the upper back.',
    relief: 'Decompresses the spine after rowing and pulling.' }],
  lats: [{ id: 'cd-lat-stretch', name: 'Kneeling Lat Stretch', perSide: true, targets: ['lats', 'back'],
    cue: 'Hands on a bench, hips back, drop the chest and sink one side deeper.',
    relief: 'Takes the tightness out of the armpit after pull-ups.' }],
  traps: [{ id: 'cd-upper-trap', name: 'Upper Trap Stretch', perSide: true, targets: ['traps'],
    cue: 'Ear to shoulder, opposite hand behind the back. Never yank.',
    relief: 'Kills the neck-and-shoulder tension that follows heavy carries.' }],
  shoulders: [{ id: 'cd-cross-body', name: 'Cross-body Shoulder Stretch', perSide: true, targets: ['shoulders', 'rear_delts'],
    cue: 'Arm across the chest, pull at the elbow — not the wrist.',
    relief: 'Settles the delts after any overhead work.' }],
  rear_delts: [{ id: 'cd-rear-delt', name: 'Rear Delt Stretch', perSide: true, targets: ['rear_delts'],
    cue: 'Reach across and slightly down, chest stays tall.',
    relief: 'Relieves the deep ache behind the shoulder after rows.' }],
  biceps: [{ id: 'cd-bicep-wall', name: 'Wall Bicep Stretch', perSide: true, targets: ['biceps', 'chest'],
    cue: 'Palm flat on a wall behind you, rotate the body away slowly.',
    relief: 'Lengthens the biceps so tomorrow\'s elbow bend is not stiff.' }],
  triceps: [{ id: 'cd-tricep-overhead', name: 'Overhead Triceps Stretch', perSide: true, targets: ['triceps', 'lats'],
    cue: 'Hand down the spine, gentle pressure on the elbow.',
    relief: 'The single best answer to sore arms after pressing.' }],
  forearms: [{ id: 'cd-forearm', name: 'Forearm Flexor Stretch', perSide: true, targets: ['forearms'],
    cue: 'Arm straight, fingers up, pull the fingers back gently.',
    relief: 'Stops grip work turning into next-day elbow pain.' }],
  quads: [{ id: 'cd-quad-stretch', name: 'Standing Quad Stretch', perSide: true, targets: ['quads', 'hip_flexors'],
    cue: 'Heel to glute, knees together, push the hip forward.',
    relief: 'Cuts the front-thigh soreness that shows up on stairs.' }],
  hamstrings: [{ id: 'cd-hamstring', name: 'Seated Hamstring Stretch', perSide: true, targets: ['hamstrings', 'calves'],
    cue: 'Hinge from the hips with a flat back. Do not round to reach further.',
    relief: 'The one that decides whether tomorrow\'s walk feels tight.' }],
  glutes: [{ id: 'cd-figure-four', name: 'Figure-Four Glute Stretch', perSide: true, targets: ['glutes'],
    cue: 'Ankle over the opposite knee, pull the back thigh toward you.',
    relief: 'Eases the deep hip tightness after squats and lunges.' }],
  adductors: [{ id: 'cd-frog', name: 'Butterfly / Frog Stretch', perSide: false, targets: ['adductors', 'glutes'],
    cue: 'Soles together, let the knees fall. Relax rather than push.',
    relief: 'Opens the inner thigh after wide-stance work.' }],
  calves: [{ id: 'cd-calf-wall', name: 'Wall Calf Stretch', perSide: true, targets: ['calves'],
    cue: 'Back leg straight, heel down, hips forward. Then bend the knee slightly.',
    relief: 'Prevents the tight-calf limp after running or jumping.' }],
  core: [{ id: 'cd-cobra', name: 'Cobra Stretch', perSide: false, targets: ['core', 'hip_flexors'],
    cue: 'Press the chest up, hips stay down, shoulders away from the ears.',
    relief: 'Lengthens the abs you just shortened.' }],
  obliques: [{ id: 'cd-side-bend', name: 'Standing Side Bend', perSide: true, targets: ['obliques', 'lats'],
    cue: 'Reach one arm overhead and lean. Do not twist as you go.',
    relief: 'Releases the side-of-torso tightness after rotation work.' }],
  lower_back: [{ id: 'cd-supine-twist', name: 'Supine Spinal Twist', perSide: true, targets: ['lower_back', 'obliques', 'glutes'],
    cue: 'On your back, drop both knees to one side, shoulders stay down.',
    relief: 'The go-to reset after deadlifts and heavy hinging.' }],
  hip_flexors: [{ id: 'cd-couch-stretch', name: 'Half-kneeling Hip Flexor Stretch', perSide: true, targets: ['hip_flexors', 'quads'],
    cue: 'Tuck the pelvis under first, then ease forward. Squeeze the back glute.',
    relief: 'Counters both squatting and a day spent in a chair.' }],
  heart: [],
};

const BREATHING: CooldownStep = {
  id: 'cd-breathing',
  name: 'Box Breathing',
  kind: 'breathing',
  holdSeconds: 120,
  perSide: false,
  cue: 'In for 4, hold 4, out for 6, hold 2. Lie down or sit tall.',
  relief: 'Switches you out of fight-or-flight so recovery can actually start.',
  targets: ['heart'],
};

/**
 * Build the cool-down from the muscles the session actually trained.
 * Holds run 30–45s — the range where static stretching changes range of motion.
 */
export function buildCooldown(
  trainedMuscles: MuscleGroup[],
  minutes: number,
  options: { intense?: boolean } = {},
): CooldownStep[] {
  const budget = minutes <= 30 ? 3 : minutes <= 45 ? 4 : 5;
  const hold = options.intense ? 45 : 35;

  const steps: CooldownStep[] = [];
  const seen = new Set<string>();

  for (const muscle of trainedMuscles) {
    if (steps.length >= budget) break;
    for (const stretch of STRETCHES[muscle] ?? []) {
      if (seen.has(stretch.id) || steps.length >= budget) continue;
      seen.add(stretch.id);
      steps.push({ ...stretch, kind: 'static', holdSeconds: hold });
    }
  }

  // A session that trained nothing specific still gets the essentials.
  if (steps.length === 0) {
    steps.push({ ...STRETCHES.hamstrings[0], kind: 'static', holdSeconds: hold });
    steps.push({ ...STRETCHES.back[0], kind: 'static', holdSeconds: hold });
  }

  steps.push(BREATHING);
  return steps;
}

/** Rest-day mobility flow — keeps blood moving without adding fatigue. */
export function buildRestDayFlow(): CooldownStep[] {
  const ids: MuscleGroup[] = ['hip_flexors', 'hamstrings', 'back', 'chest', 'glutes', 'calves'];
  const steps = ids
    .map(m => STRETCHES[m]?.[0])
    .filter(Boolean)
    .map(s => ({ ...s!, kind: 'static' as const, holdSeconds: 40 }));
  return [...steps, BREATHING];
}

export function totalWarmupSeconds(steps: WarmupStep[]): number {
  return steps.reduce((sum, s) => sum + s.durationSeconds * (s.perSide ? 2 : 1), 0);
}

export function totalCooldownSeconds(steps: CooldownStep[]): number {
  return steps.reduce((sum, s) => sum + s.holdSeconds * (s.perSide ? 2 : 1), 0);
}

/** Round-robin merge so no single pattern monopolises the warm-up budget. */
function interleave(lists: string[][]): string[] {
  const out: string[] = [];
  const max = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (list[i]) out.push(list[i]);
    }
  }
  return out;
}
