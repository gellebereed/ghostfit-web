/**
 * GhostFit — Exercise Library
 *
 * A tagged movement database the program engine selects from. Every entry
 * carries its movement pattern, the muscles it actually trains, the equipment
 * it truly needs, and a difficulty level so a beginner is never handed an
 * advanced lift.
 *
 * Selection contract: an exercise is only offered when the user owns EVERY
 * item in `equipment` (an empty list means bodyweight, always available).
 */
import type { Exercise, MovementPattern, MuscleGroup } from './types';

export interface LibraryExercise {
  id: string;
  name: string;
  pattern: MovementPattern;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  /** ALL items must be owned. Empty = bodyweight. */
  equipment: string[];
  metricType: Exercise['metricType'];
  type: 'strength' | 'cardio';
  /** 1 = regression, safe for day one · 2 = standard · 3 = advanced */
  level: 1 | 2 | 3;
  compound: boolean;
  unilateral: boolean;
  /** Systemically expensive — the engine allows at most one or two per session. */
  taxing: boolean;
  /** Shown while the set is running. */
  cue: string;
  /** Hold / work seconds for duration and cardio items. */
  defaultSeconds?: number;
}

type Def =
  Pick<LibraryExercise, 'id' | 'name' | 'pattern' | 'primary' | 'cue'> &
  Partial<LibraryExercise>;

const def = (e: Def): LibraryExercise => ({
  secondary: [],
  equipment: [],
  metricType: 'weight_reps',
  type: 'strength',
  level: 2,
  compound: false,
  unilateral: false,
  taxing: false,
  ...e,
});

const bw = (e: Def): LibraryExercise => def({ metricType: 'bodyweight_reps', ...e });

// ─── Horizontal push ─────────────────────────────────────────────────────────

const HORIZONTAL_PUSH: LibraryExercise[] = [
  bw({ id: 'incline-pushup', name: 'Incline Push-up', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'shoulders'], level: 1, compound: true,
    cue: 'Hands on a bench or chair. Body in one line — no sagging hips.' }),
  bw({ id: 'knee-pushup', name: 'Knee Push-up', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'shoulders'], level: 1, compound: true,
    cue: 'Knees down, hips forward. Chest to the floor, not your chin.' }),
  bw({ id: 'pushup', name: 'Push-up', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'shoulders', 'core'], compound: true,
    cue: 'Elbows at 45°, ribs tucked. Squeeze the floor apart.' }),
  bw({ id: 'deficit-pushup', name: 'Deficit Push-up', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'shoulders'], level: 3, compound: true,
    cue: 'Hands elevated on books or plates — sink deeper than the floor allows.' }),
  bw({ id: 'dip', name: 'Parallel Bar Dip', pattern: 'horizontal_push', primary: ['chest', 'triceps'], secondary: ['shoulders'], equipment: ['Pull-up Bar'], level: 3, compound: true, taxing: true,
    cue: 'Lean forward slightly for chest. Stop when shoulders reach elbow height.' }),
  def({ id: 'db-bench-press', name: 'Dumbbell Bench Press', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['Dumbbells', 'Bench'], compound: true, taxing: true,
    cue: 'Shoulder blades pinned to the bench. Lower until you feel the stretch.' }),
  def({ id: 'db-floor-press', name: 'Dumbbell Floor Press', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps'], equipment: ['Dumbbells'], compound: true,
    cue: 'Triceps touch the floor, pause, then drive up. Shoulder-friendly.' }),
  def({ id: 'db-incline-press', name: 'Incline Dumbbell Press', pattern: 'horizontal_push', primary: ['chest', 'shoulders'], secondary: ['triceps'], equipment: ['Dumbbells', 'Bench'], compound: true, taxing: true,
    cue: 'Around 30° incline. Press up and slightly together.' }),
  def({ id: 'bb-bench-press', name: 'Barbell Bench Press', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['Barbell', 'Bench'], compound: true, taxing: true,
    cue: 'Bar to the lower chest, elbows tucked. Drive your feet into the floor.' }),
  def({ id: 'smith-bench-press', name: 'Smith Machine Bench Press', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps'], equipment: ['Smith Machine', 'Bench'], compound: true,
    cue: 'Fixed path — chase the stretch and a controlled lockout.' }),
  def({ id: 'cable-chest-press', name: 'Cable Chest Press', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['Cable Machine'], compound: true,
    cue: 'Constant tension. Finish with hands almost touching.' }),
  def({ id: 'band-chest-press', name: 'Band Chest Press', pattern: 'horizontal_push', primary: ['chest'], secondary: ['triceps'], equipment: ['Resistance Bands'], compound: true,
    cue: 'Anchor behind you. Resist the band on the way back — that half matters.' }),
  def({ id: 'db-fly', name: 'Dumbbell Fly', pattern: 'horizontal_push', primary: ['chest'], secondary: [], equipment: ['Dumbbells', 'Bench'],
    cue: 'Soft elbows, wide arc. Stretch is the point — leave ego weight off.' }),
  def({ id: 'cable-fly', name: 'Cable Fly', pattern: 'horizontal_push', primary: ['chest'], secondary: [], equipment: ['Cable Machine'],
    cue: 'Hug a barrel. Pause and squeeze for a full second at the front.' }),
];

// ─── Vertical push ───────────────────────────────────────────────────────────

const VERTICAL_PUSH: LibraryExercise[] = [
  bw({ id: 'pike-pushup', name: 'Pike Push-up', pattern: 'vertical_push', primary: ['shoulders'], secondary: ['triceps'], compound: true,
    cue: 'Hips high, crown of the head to the floor between your hands.' }),
  bw({ id: 'elevated-pike-pushup', name: 'Elevated Pike Push-up', pattern: 'vertical_push', primary: ['shoulders'], secondary: ['triceps'], level: 3, compound: true,
    cue: 'Feet on a bench — nearly vertical loading on the delts.' }),
  def({ id: 'db-shoulder-press', name: 'Dumbbell Shoulder Press', pattern: 'vertical_push', primary: ['shoulders'], secondary: ['triceps'], equipment: ['Dumbbells'], compound: true,
    cue: 'Ribs down, glutes tight. Press until the biceps pass your ears.' }),
  def({ id: 'db-arnold-press', name: 'Arnold Press', pattern: 'vertical_push', primary: ['shoulders'], secondary: ['triceps'], equipment: ['Dumbbells'], level: 3, compound: true,
    cue: 'Rotate palms out as you press. Slow the rotation down.' }),
  def({ id: 'bb-overhead-press', name: 'Barbell Overhead Press', pattern: 'vertical_push', primary: ['shoulders'], secondary: ['triceps', 'core'], equipment: ['Barbell'], compound: true, taxing: true,
    cue: 'Squeeze glutes, head through the window at the top.' }),
  def({ id: 'kb-overhead-press', name: 'Kettlebell Overhead Press', pattern: 'vertical_push', primary: ['shoulders'], secondary: ['triceps', 'core'], equipment: ['Kettlebell'], compound: true, unilateral: true,
    cue: 'Bell rests on the forearm. Own the lockout before lowering.' }),
  def({ id: 'band-overhead-press', name: 'Band Overhead Press', pattern: 'vertical_push', primary: ['shoulders'], secondary: ['triceps'], equipment: ['Resistance Bands'], compound: true,
    cue: 'Stand on the band. Hardest at lockout — hold it there a beat.' }),
  def({ id: 'smith-shoulder-press', name: 'Smith Machine Shoulder Press', pattern: 'vertical_push', primary: ['shoulders'], secondary: ['triceps'], equipment: ['Smith Machine'], compound: true,
    cue: 'Bar path is fixed — focus on driving straight up, not forward.' }),
];

// ─── Horizontal pull ─────────────────────────────────────────────────────────

const HORIZONTAL_PULL: LibraryExercise[] = [
  bw({ id: 'prone-swimmer', name: 'Prone Y-T-W Raise', pattern: 'horizontal_pull', primary: ['rear_delts', 'back'], secondary: ['traps'], level: 1,
    cue: 'Face down, thumbs up. Lift with the shoulder blades, not the hands.' }),
  bw({ id: 'inverted-row', name: 'Inverted Row', pattern: 'horizontal_pull', primary: ['back', 'lats'], secondary: ['biceps', 'rear_delts'], equipment: ['Pull-up Bar'], compound: true,
    cue: 'Body rigid as a plank. Chest to the bar, elbows past your ribs.' }),
  bw({ id: 'table-row', name: 'Table Row', pattern: 'horizontal_pull', primary: ['back'], secondary: ['biceps'], level: 1, compound: true,
    cue: 'Under a sturdy table, heels down. Pull the chest to the edge.' }),
  def({ id: 'db-row', name: 'Dumbbell Row', pattern: 'horizontal_pull', primary: ['lats', 'back'], secondary: ['biceps', 'rear_delts'], equipment: ['Dumbbells'], compound: true, unilateral: true,
    cue: 'Pull the elbow to the hip pocket. No twisting the torso.' }),
  def({ id: 'db-chest-supported-row', name: 'Chest-Supported Dumbbell Row', pattern: 'horizontal_pull', primary: ['back', 'rear_delts'], secondary: ['lats', 'biceps'], equipment: ['Dumbbells', 'Bench'], compound: true,
    cue: 'Chest glued to the bench — this one is all back, no momentum.' }),
  def({ id: 'bb-bent-row', name: 'Barbell Bent-over Row', pattern: 'horizontal_pull', primary: ['back', 'lats'], secondary: ['biceps', 'lower_back'], equipment: ['Barbell'], compound: true, taxing: true,
    cue: 'Hinge to 45°, flat back. Bar to the belly button.' }),
  def({ id: 'cable-row', name: 'Seated Cable Row', pattern: 'horizontal_pull', primary: ['back', 'lats'], secondary: ['biceps'], equipment: ['Cable Machine'], compound: true,
    cue: 'Tall chest. Lead with the elbows, pause with the shoulder blades pinched.' }),
  def({ id: 'band-row', name: 'Band Seated Row', pattern: 'horizontal_pull', primary: ['back'], secondary: ['biceps', 'rear_delts'], equipment: ['Resistance Bands'], compound: true,
    cue: 'Band around the feet. Squeeze for a count at the end of every rep.' }),
  def({ id: 'kb-row', name: 'Kettlebell Row', pattern: 'horizontal_pull', primary: ['lats', 'back'], secondary: ['biceps'], equipment: ['Kettlebell'], compound: true, unilateral: true,
    cue: 'Hinge over, brace the free hand. Row to the hip, not the shoulder.' }),
  def({ id: 'rowing-machine-row', name: 'Rowing Machine Intervals', pattern: 'conditioning', primary: ['back', 'heart'], secondary: ['lats', 'quads', 'glutes'], equipment: ['Rowing Machine'], metricType: 'cardio', type: 'cardio', compound: true, defaultSeconds: 900,
    cue: 'Legs, then back, then arms. Reverse that order on the return.' }),
];

// ─── Vertical pull ───────────────────────────────────────────────────────────

const VERTICAL_PULL: LibraryExercise[] = [
  bw({ id: 'band-lat-pulldown', name: 'Band Lat Pulldown', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps', 'back'], equipment: ['Resistance Bands'], level: 1, compound: true,
    cue: 'Anchor high. Pull the elbows down into your back pockets.' }),
  bw({ id: 'negative-pullup', name: 'Negative Pull-up', pattern: 'vertical_pull', primary: ['lats'], secondary: ['biceps', 'back'], equipment: ['Pull-up Bar'], level: 1, compound: true,
    cue: 'Jump to the top, then take 5 slow seconds coming down.' }),
  bw({ id: 'chinup', name: 'Chin-up', pattern: 'vertical_pull', primary: ['lats', 'biceps'], secondary: ['back', 'core'], equipment: ['Pull-up Bar'], compound: true, taxing: true,
    cue: 'Palms toward you. Chest to the bar, no kipping.' }),
  bw({ id: 'pullup', name: 'Pull-up', pattern: 'vertical_pull', primary: ['lats'], secondary: ['back', 'biceps', 'core'], equipment: ['Pull-up Bar'], level: 3, compound: true, taxing: true,
    cue: 'Start from a dead hang. Drive the elbows down and back.' }),
  def({ id: 'cable-lat-pulldown', name: 'Lat Pulldown', pattern: 'vertical_pull', primary: ['lats'], secondary: ['back', 'biceps'], equipment: ['Cable Machine'], compound: true,
    cue: 'Slight lean back, bar to the collarbone. Do not shrug.' }),
  def({ id: 'db-pullover', name: 'Dumbbell Pullover', pattern: 'vertical_pull', primary: ['lats'], secondary: ['chest'], equipment: ['Dumbbells', 'Bench'],
    cue: 'One dumbbell, arms nearly straight. Feel the stretch under the armpit.' }),
];

// ─── Squat ───────────────────────────────────────────────────────────────────

const SQUAT: LibraryExercise[] = [
  bw({ id: 'box-squat', name: 'Box Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['core'], level: 1, compound: true,
    cue: 'Sit back to a chair, tap, stand. Knees track over the toes.' }),
  bw({ id: 'bodyweight-squat', name: 'Bodyweight Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['core'], compound: true,
    cue: 'Chest proud, heels down, hips below the knees if your mobility allows.' }),
  bw({ id: 'tempo-squat', name: 'Tempo Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['core'], compound: true,
    cue: 'Three seconds down, one second pause, drive up. Time under tension.' }),
  bw({ id: 'pistol-box-squat', name: 'Single-leg Box Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['core'], level: 3, compound: true, unilateral: true,
    cue: 'One leg, sit to the box under control. Balance is part of the lift.' }),
  def({ id: 'goblet-squat', name: 'Goblet Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['core'], equipment: ['Dumbbells'], compound: true,
    cue: 'Weight at the chest. Elbows brush the inside of the knees at the bottom.' }),
  def({ id: 'kb-goblet-squat', name: 'Kettlebell Goblet Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['core'], equipment: ['Kettlebell'], compound: true,
    cue: 'Bell by the horns. Pry the hips open at the bottom.' }),
  def({ id: 'bb-back-squat', name: 'Barbell Back Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core', 'lower_back'], equipment: ['Barbell'], level: 3, compound: true, taxing: true,
    cue: 'Big breath into the belly, brace, then sit between the hips.' }),
  def({ id: 'bb-front-squat', name: 'Barbell Front Squat', pattern: 'squat', primary: ['quads'], secondary: ['glutes', 'core'], equipment: ['Barbell'], level: 3, compound: true, taxing: true,
    cue: 'Elbows high the whole way. Upright torso is non-negotiable.' }),
  def({ id: 'smith-squat', name: 'Smith Machine Squat', pattern: 'squat', primary: ['quads', 'glutes'], secondary: [], equipment: ['Smith Machine'], compound: true,
    cue: 'Feet slightly forward. Controlled descent, no bouncing out of the hole.' }),
  def({ id: 'leg-press', name: 'Leg Press', pattern: 'squat', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: ['Leg Press'], compound: true,
    cue: 'Knees to armpits, never lock out hard at the top.' }),
];

// ─── Hinge ───────────────────────────────────────────────────────────────────

const HINGE: LibraryExercise[] = [
  bw({ id: 'glute-bridge', name: 'Glute Bridge', pattern: 'hinge', primary: ['glutes'], secondary: ['hamstrings'], level: 1,
    cue: 'Ribs down, drive through the heels, squeeze hard for a second at the top.' }),
  bw({ id: 'single-leg-glute-bridge', name: 'Single-leg Glute Bridge', pattern: 'hinge', primary: ['glutes'], secondary: ['hamstrings'], unilateral: true,
    cue: 'One foot down, opposite knee hugged in. Keep the hips level.' }),
  bw({ id: 'good-morning-bw', name: 'Bodyweight Good Morning', pattern: 'hinge', primary: ['hamstrings'], secondary: ['glutes', 'lower_back'], level: 1,
    cue: 'Hands behind the head. Push the hips back, flat back, feel the hamstrings.' }),
  bw({ id: 'nordic-curl-eccentric', name: 'Nordic Curl Negative', pattern: 'hinge', primary: ['hamstrings'], secondary: ['glutes'], level: 3,
    cue: 'Anchor the ankles. Fight the fall for as long as you can.' }),
  def({ id: 'db-rdl', name: 'Dumbbell Romanian Deadlift', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['lower_back'], equipment: ['Dumbbells'], compound: true,
    cue: 'Hips travel back, not down. Stop when the hamstrings shout.' }),
  def({ id: 'db-single-leg-rdl', name: 'Single-leg Romanian Deadlift', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['core'], equipment: ['Dumbbells'], level: 3, compound: true, unilateral: true,
    cue: 'Back leg and torso form one line. Slow is stronger here.' }),
  def({ id: 'bb-rdl', name: 'Barbell Romanian Deadlift', pattern: 'hinge', primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'back'], equipment: ['Barbell'], compound: true, taxing: true,
    cue: 'Bar stays against the legs. Neutral spine from start to finish.' }),
  def({ id: 'bb-deadlift', name: 'Barbell Deadlift', pattern: 'hinge', primary: ['glutes', 'hamstrings'], secondary: ['lower_back', 'back', 'traps'], equipment: ['Barbell'], level: 3, compound: true, taxing: true,
    cue: 'Pull the slack out, then push the floor away. Lockout with the glutes.' }),
  def({ id: 'kb-swing', name: 'Kettlebell Swing', pattern: 'hinge', primary: ['glutes', 'hamstrings'], secondary: ['core', 'heart'], equipment: ['Kettlebell'], metricType: 'reps_only', compound: true,
    cue: 'Hips snap, arms are ropes. The bell floats — you do not lift it.' }),
  def({ id: 'db-hip-thrust', name: 'Dumbbell Hip Thrust', pattern: 'hinge', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['Dumbbells', 'Bench'],
    cue: 'Shoulders on the bench, chin tucked. Full lockout, ribs down.' }),
  def({ id: 'band-pull-through', name: 'Band Pull-through', pattern: 'hinge', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['Resistance Bands'],
    cue: 'Band between the legs from behind. Snap the hips forward to finish.' }),
  def({ id: 'cable-pull-through', name: 'Cable Pull-through', pattern: 'hinge', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['Cable Machine'],
    cue: 'Hinge deep, then stand tall by squeezing the glutes — not the lower back.' }),
];

// ─── Lunge / single leg ──────────────────────────────────────────────────────

const LUNGE: LibraryExercise[] = [
  bw({ id: 'reverse-lunge', name: 'Reverse Lunge', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['core'], compound: true, unilateral: true,
    cue: 'Step back, drop the back knee softly, drive through the front heel.' }),
  bw({ id: 'split-squat', name: 'Split Squat', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: [], level: 1, compound: true, unilateral: true,
    cue: 'Feet stay planted. Straight down, straight up.' }),
  bw({ id: 'step-up', name: 'Step-up', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['core'], compound: true, unilateral: true,
    cue: 'Full foot on the box. Do not push off the back foot to cheat.' }),
  bw({ id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['hamstrings'], level: 3, compound: true, unilateral: true, taxing: true,
    cue: 'Rear foot elevated. Lean the torso slightly forward for more glute.' }),
  bw({ id: 'walking-lunge', name: 'Walking Lunge', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['core'], compound: true, unilateral: true,
    cue: 'Long strides. Torso upright, no rushing the turnaround.' }),
  def({ id: 'db-reverse-lunge', name: 'Dumbbell Reverse Lunge', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['core'], equipment: ['Dumbbells'], compound: true, unilateral: true,
    cue: 'Weights hang heavy at the sides. Control the step back.' }),
  def({ id: 'db-bulgarian-split-squat', name: 'Dumbbell Bulgarian Split Squat', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: ['Dumbbells', 'Bench'], level: 3, compound: true, unilateral: true, taxing: true,
    cue: 'The hardest leg exercise you can do with two dumbbells. Earn it.' }),
  def({ id: 'db-step-up', name: 'Dumbbell Step-up', pattern: 'lunge', primary: ['quads', 'glutes'], secondary: [], equipment: ['Dumbbells', 'Bench'], compound: true, unilateral: true,
    cue: 'Drive through the top foot. Lower yourself — do not drop.' }),
];

// ─── Carry ───────────────────────────────────────────────────────────────────

const CARRY: LibraryExercise[] = [
  def({ id: 'farmer-carry', name: 'Farmer Carry', pattern: 'carry', primary: ['forearms', 'traps'], secondary: ['core', 'glutes'], equipment: ['Dumbbells'], metricType: 'duration', defaultSeconds: 40, compound: true,
    cue: 'Tall and quiet. Shoulders down, ribs stacked over the hips.' }),
  def({ id: 'suitcase-carry', name: 'Suitcase Carry', pattern: 'carry', primary: ['obliques', 'forearms'], secondary: ['core', 'traps'], equipment: ['Kettlebell'], metricType: 'duration', defaultSeconds: 30, compound: true, unilateral: true,
    cue: 'Weight in one hand. Refuse to lean — that resistance is the exercise.' }),
];

// ─── Core ────────────────────────────────────────────────────────────────────

const CORE: LibraryExercise[] = [
  def({ id: 'plank', name: 'Plank', pattern: 'core_anti_extension', primary: ['core'], secondary: ['shoulders'], metricType: 'duration', defaultSeconds: 40,
    cue: 'Squeeze glutes, tuck the ribs. Quality beats another 30 seconds.' }),
  def({ id: 'dead-bug', name: 'Dead Bug', pattern: 'core_anti_extension', primary: ['core'], secondary: ['hip_flexors'], metricType: 'bodyweight_reps', level: 1,
    cue: 'Lower back glued to the floor. If it lifts, shorten the reach.' }),
  def({ id: 'hollow-hold', name: 'Hollow Body Hold', pattern: 'core_anti_extension', primary: ['core'], secondary: [], metricType: 'duration', defaultSeconds: 30, level: 3,
    cue: 'Low back pressed down, shoulders and heels just off the floor.' }),
  def({ id: 'ab-wheel', name: 'Ab Wheel Rollout', pattern: 'core_anti_extension', primary: ['core'], secondary: ['lats'], equipment: ['Medicine Ball'], metricType: 'bodyweight_reps', level: 3,
    cue: 'Roll only as far as you can keep the hips from sagging.' }),
  def({ id: 'side-plank', name: 'Side Plank', pattern: 'core_anti_rotation', primary: ['obliques'], secondary: ['core'], metricType: 'duration', defaultSeconds: 30, unilateral: true,
    cue: 'Stack the hips, push the floor away. Both sides, equal time.' }),
  def({ id: 'pallof-press', name: 'Pallof Press', pattern: 'core_anti_rotation', primary: ['obliques', 'core'], secondary: [], equipment: ['Resistance Bands'], metricType: 'bodyweight_reps', unilateral: true,
    cue: 'Band pulls you sideways. Press out and refuse to rotate.' }),
  def({ id: 'cable-pallof-press', name: 'Cable Pallof Press', pattern: 'core_anti_rotation', primary: ['obliques', 'core'], secondary: [], equipment: ['Cable Machine'], metricType: 'bodyweight_reps', unilateral: true,
    cue: 'Stand side-on. The cable wants to twist you — do not let it.' }),
  def({ id: 'bird-dog', name: 'Bird Dog', pattern: 'core_anti_rotation', primary: ['core', 'lower_back'], secondary: ['glutes'], metricType: 'bodyweight_reps', level: 1, unilateral: true,
    cue: 'Opposite arm and leg. Move slowly — hips stay square to the floor.' }),
  def({ id: 'hanging-knee-raise', name: 'Hanging Knee Raise', pattern: 'core_flexion', primary: ['core', 'hip_flexors'], secondary: ['forearms'], equipment: ['Pull-up Bar'], metricType: 'bodyweight_reps',
    cue: 'Curl the pelvis up — do not just swing the legs.' }),
  def({ id: 'lying-leg-raise', name: 'Lying Leg Raise', pattern: 'core_flexion', primary: ['core', 'hip_flexors'], secondary: [], metricType: 'bodyweight_reps',
    cue: 'Hands under the hips. Lower until just before the back arches.' }),
  def({ id: 'reverse-crunch', name: 'Reverse Crunch', pattern: 'core_flexion', primary: ['core'], secondary: [], metricType: 'bodyweight_reps', level: 1,
    cue: 'Knees to chest, lift the hips off the floor at the top.' }),
  def({ id: 'russian-twist', name: 'Russian Twist', pattern: 'core_flexion', primary: ['obliques'], secondary: ['core'], metricType: 'bodyweight_reps',
    cue: 'Chest tall, rotate from the ribs — not the arms.' }),

  // Loadable flexion. The abs are skeletal muscle and grow the same way every
  // other muscle does — by being asked to do more over time. Bodyweight
  // crunches cap out; these can be loaded for years, which is the single
  // biggest reason to prefer them.
  def({ id: 'cable-crunch', name: 'Cable Crunch', pattern: 'core_flexion', primary: ['core'], secondary: ['obliques'], equipment: ['Cable Machine'], metricType: 'weight_reps',
    cue: 'Kneel, rope by your ears. Curl the ribs to the hips — hips stay put, arms do nothing.' }),
  def({ id: 'weighted-decline-crunch', name: 'Weighted Decline Crunch', pattern: 'core_flexion', primary: ['core'], secondary: ['hip_flexors'], equipment: ['Bench', 'Dumbbells'], metricType: 'weight_reps',
    cue: 'Decline the bench if it adjusts. Dumbbell on the chest, round the spine up one vertebra at a time.' }),
  def({ id: 'weighted-floor-crunch', name: 'Weighted Crunch', pattern: 'core_flexion', primary: ['core'], secondary: [], equipment: ['Dumbbells'], metricType: 'weight_reps', level: 1,
    cue: 'Dumbbell held at the chest. Lift the shoulder blades clear of the floor, then lower slowly.' }),

  // Bottom-up flexion. Posterior pelvic tilt biases the lower fibres, which
  // the crunch family reaches least — which is why the pairing works.
  def({ id: 'hanging-leg-raise', name: 'Hanging Leg Raise', pattern: 'core_flexion', primary: ['core', 'hip_flexors'], secondary: ['forearms'], equipment: ['Pull-up Bar'], metricType: 'bodyweight_reps', level: 3,
    cue: 'Legs straight, toes to the bar if you can. No swinging — dead stop each rep.' }),
  def({ id: 'captains-chair-leg-raise', name: 'Captain’s Chair Leg Raise', pattern: 'core_flexion', primary: ['core', 'hip_flexors'], secondary: [], equipment: ['Dip Station'], metricType: 'bodyweight_reps',
    cue: 'Back flat to the pad. Roll the pelvis up at the top instead of stopping at 90°.' }),

  def({ id: 'cable-woodchop', name: 'Cable Woodchop', pattern: 'core_anti_rotation', primary: ['obliques'], secondary: ['core', 'shoulders'], equipment: ['Cable Machine'], metricType: 'weight_reps', unilateral: true,
    cue: 'Rotate from the trunk, arms stay long. Hips face forward the whole way.' }),
];

// ─── Isolation: shoulders / arms ─────────────────────────────────────────────

const ISOLATION: LibraryExercise[] = [
  def({ id: 'db-lateral-raise', name: 'Dumbbell Lateral Raise', pattern: 'isolation_shoulder', primary: ['shoulders'], secondary: [], equipment: ['Dumbbells'],
    cue: 'Lead with the elbows to shoulder height. Light weight, strict form.' }),
  def({ id: 'band-lateral-raise', name: 'Band Lateral Raise', pattern: 'isolation_shoulder', primary: ['shoulders'], secondary: [], equipment: ['Resistance Bands'],
    cue: 'Stand on the band. Pause at the top where it is hardest.' }),
  def({ id: 'db-rear-delt-fly', name: 'Rear Delt Fly', pattern: 'isolation_shoulder', primary: ['rear_delts'], secondary: ['back'], equipment: ['Dumbbells'],
    cue: 'Hinge over, thumbs down. Posture insurance for a life of screens.' }),
  def({ id: 'cable-face-pull', name: 'Face Pull', pattern: 'isolation_shoulder', primary: ['rear_delts', 'traps'], secondary: ['back'], equipment: ['Cable Machine'],
    cue: 'Rope to the forehead, elbows high. The best shoulder-health move there is.' }),
  def({ id: 'band-face-pull', name: 'Band Face Pull', pattern: 'isolation_shoulder', primary: ['rear_delts', 'traps'], secondary: ['back'], equipment: ['Resistance Bands'],
    cue: 'Pull apart as you pull back. External rotation at the end.' }),
  def({ id: 'db-curl', name: 'Dumbbell Curl', pattern: 'isolation_arm', primary: ['biceps'], secondary: ['forearms'], equipment: ['Dumbbells'],
    cue: 'Elbows pinned to the ribs. No swinging — the back is not a bicep.' }),
  def({ id: 'db-hammer-curl', name: 'Hammer Curl', pattern: 'isolation_arm', primary: ['biceps', 'forearms'], secondary: [], equipment: ['Dumbbells'],
    cue: 'Neutral grip. Hits the brachialis — the muscle that adds arm width.' }),
  def({ id: 'ez-curl', name: 'EZ Bar Curl', pattern: 'isolation_arm', primary: ['biceps'], secondary: ['forearms'], equipment: ['EZ Curl Bar'],
    cue: 'Angled grip saves the wrists. Control the lowering for three counts.' }),
  def({ id: 'band-curl', name: 'Band Curl', pattern: 'isolation_arm', primary: ['biceps'], secondary: ['forearms'], equipment: ['Resistance Bands'],
    cue: 'Tension never leaves. Squeeze hard at the top.' }),
  def({ id: 'cable-curl', name: 'Cable Curl', pattern: 'isolation_arm', primary: ['biceps'], secondary: ['forearms'], equipment: ['Cable Machine'],
    cue: 'Constant tension through the whole range. Stay upright.' }),
  def({ id: 'db-overhead-triceps', name: 'Overhead Triceps Extension', pattern: 'isolation_arm', primary: ['triceps'], secondary: [], equipment: ['Dumbbells'],
    cue: 'Elbows point forward and stay there. Deep stretch behind the head.' }),
  def({ id: 'db-skullcrusher', name: 'Dumbbell Skullcrusher', pattern: 'isolation_arm', primary: ['triceps'], secondary: [], equipment: ['Dumbbells', 'Bench'],
    cue: 'Lower to the forehead, elbows still. Slow eccentric.' }),
  def({ id: 'cable-pushdown', name: 'Triceps Pushdown', pattern: 'isolation_arm', primary: ['triceps'], secondary: [], equipment: ['Cable Machine'],
    cue: 'Upper arms locked at the sides. Full lockout, then resist back up.' }),
  def({ id: 'band-pushdown', name: 'Band Triceps Pushdown', pattern: 'isolation_arm', primary: ['triceps'], secondary: [], equipment: ['Resistance Bands'],
    cue: 'Anchor high. Straighten fully and squeeze for one second.' }),
  bw({ id: 'bench-dip', name: 'Bench Dip', pattern: 'isolation_arm', primary: ['triceps'], secondary: ['chest', 'shoulders'], equipment: ['Bench'],
    cue: 'Hips close to the bench. Stop if the front of the shoulder pinches.' }),
  bw({ id: 'diamond-pushup', name: 'Diamond Push-up', pattern: 'isolation_arm', primary: ['triceps'], secondary: ['chest'], level: 3,
    cue: 'Hands under the sternum. Elbows brush the ribs on the way down.' }),
];

// ─── Isolation: legs & calves ────────────────────────────────────────────────

const LEG_ISOLATION: LibraryExercise[] = [
  def({ id: 'db-calf-raise', name: 'Standing Calf Raise', pattern: 'calf', primary: ['calves'], secondary: [], equipment: ['Dumbbells'],
    cue: 'Full stretch at the bottom, two-second squeeze at the top.' }),
  bw({ id: 'bw-calf-raise', name: 'Bodyweight Calf Raise', pattern: 'calf', primary: ['calves'], secondary: [], level: 1,
    cue: 'Toes on a step. Sink low, rise high, no bouncing.' }),
  bw({ id: 'single-leg-calf-raise', name: 'Single-leg Calf Raise', pattern: 'calf', primary: ['calves'], secondary: [], unilateral: true,
    cue: 'One leg at a time. Balance with a fingertip on the wall.' }),
  bw({ id: 'slider-leg-curl', name: 'Sliding Leg Curl', pattern: 'isolation_leg', primary: ['hamstrings'], secondary: ['glutes'], metricType: 'bodyweight_reps',
    cue: 'Heels on towels, hips high. Pull the heels in without dropping the hips.' }),
  def({ id: 'band-leg-curl', name: 'Band Leg Curl', pattern: 'isolation_leg', primary: ['hamstrings'], secondary: [], equipment: ['Resistance Bands'],
    cue: 'Face down, band on the ankle. Squeeze the hamstring at full bend.' }),
  bw({ id: 'wall-sit', name: 'Wall Sit', pattern: 'isolation_leg', primary: ['quads'], secondary: ['glutes'], metricType: 'duration', defaultSeconds: 45,
    cue: 'Thighs parallel, back flat on the wall. Breathe through the burn.' }),
  def({ id: 'cossack-squat', name: 'Cossack Squat', pattern: 'isolation_leg', primary: ['adductors', 'quads'], secondary: ['glutes'], metricType: 'bodyweight_reps', unilateral: true, level: 3,
    cue: 'Wide stance, sink to one side. Opens the hips as it builds them.' }),
];

// ─── Conditioning ────────────────────────────────────────────────────────────

const CONDITIONING: LibraryExercise[] = [
  def({ id: 'treadmill-intervals', name: 'Treadmill Intervals', pattern: 'conditioning', primary: ['heart'], secondary: ['quads', 'calves'], equipment: ['Treadmill'], metricType: 'cardio', type: 'cardio', defaultSeconds: 1200, compound: true,
    cue: '60s hard / 90s easy. Hard means you cannot hold a conversation.' }),
  def({ id: 'treadmill-zone2', name: 'Treadmill Zone 2 Walk', pattern: 'conditioning', primary: ['heart'], secondary: [], equipment: ['Treadmill'], metricType: 'cardio', type: 'cardio', defaultSeconds: 1800, level: 1,
    cue: 'Brisk incline walk. You should be able to talk, not sing.' }),
  def({ id: 'spin-intervals', name: 'Spin Bike Intervals', pattern: 'conditioning', primary: ['heart'], secondary: ['quads', 'glutes'], equipment: ['Spin Bike'], metricType: 'cardio', type: 'cardio', defaultSeconds: 1200, compound: true,
    cue: '30s sprint / 90s spin. Keep the hips quiet in the saddle.' }),
  def({ id: 'rower-steady', name: 'Rowing Machine Steady State', pattern: 'conditioning', primary: ['heart', 'back'], secondary: ['quads', 'lats'], equipment: ['Rowing Machine'], metricType: 'cardio', type: 'cardio', defaultSeconds: 1200, level: 1, compound: true,
    cue: 'Long, smooth strokes. Drive with the legs, finish with the arms.' }),
  def({ id: 'jump-rope', name: 'Jump Rope', pattern: 'conditioning', primary: ['heart', 'calves'], secondary: [], equipment: ['Jump Rope'], metricType: 'cardio', type: 'cardio', defaultSeconds: 600,
    cue: 'Small bounces, wrists do the turning. Rest as needed inside the block.' }),
  def({ id: 'burpee', name: 'Burpees', pattern: 'conditioning', primary: ['heart'], secondary: ['chest', 'quads', 'core'], metricType: 'reps_only', compound: true, level: 3,
    cue: 'Chest to the floor, full stand at the top. Pace it — do not sprint set one.' }),
  def({ id: 'mountain-climber', name: 'Mountain Climbers', pattern: 'conditioning', primary: ['core', 'heart'], secondary: ['shoulders'], metricType: 'reps_only',
    cue: 'Hips low, shoulders over the wrists. Fast feet, quiet torso.' }),
  def({ id: 'high-knees', name: 'High Knees', pattern: 'conditioning', primary: ['heart', 'hip_flexors'], secondary: ['calves'], metricType: 'reps_only', level: 1,
    cue: 'Knees to hip height, land on the balls of the feet.' }),
  def({ id: 'jumping-jack', name: 'Jumping Jacks', pattern: 'conditioning', primary: ['heart'], secondary: ['calves', 'shoulders'], metricType: 'reps_only', level: 1,
    cue: 'Full range at the top. Soft knees on every landing.' }),
  def({ id: 'squat-jump', name: 'Squat Jumps', pattern: 'conditioning', primary: ['quads', 'glutes'], secondary: ['heart', 'calves'], metricType: 'reps_only', level: 3,
    cue: 'Land quiet and absorb. Jumping is easy — landing is the skill.' }),
  def({ id: 'med-ball-slam', name: 'Medicine Ball Slam', pattern: 'conditioning', primary: ['core', 'heart'], secondary: ['lats', 'shoulders'], equipment: ['Medicine Ball'], metricType: 'reps_only',
    cue: 'Full overhead reach, then slam with everything. Exhale on impact.' }),
  def({ id: 'kb-swing-intervals', name: 'Kettlebell Swing Intervals', pattern: 'conditioning', primary: ['glutes', 'heart'], secondary: ['hamstrings', 'core'], equipment: ['Kettlebell'], metricType: 'reps_only', compound: true,
    cue: '20 swings, 40s rest, repeat. Hips do the work, not the shoulders.' }),
];

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  ...HORIZONTAL_PUSH, ...VERTICAL_PUSH, ...HORIZONTAL_PULL, ...VERTICAL_PULL,
  ...SQUAT, ...HINGE, ...LUNGE, ...CARRY, ...CORE, ...ISOLATION,
  ...LEG_ISOLATION, ...CONDITIONING,
];

const BY_ID = new Map(EXERCISE_LIBRARY.map(e => [e.id, e]));

export function getLibraryExercise(id: string): LibraryExercise | undefined {
  return BY_ID.get(id);
}

/** 'Bodyweight Only' is a marker for "no gear", not a piece of equipment. */
function ownedSet(equipment: string[]): Set<string> {
  return new Set(equipment.filter(e => e && e !== 'Bodyweight Only'));
}

export function isAvailable(exercise: LibraryExercise, equipment: string[]): boolean {
  if (exercise.equipment.length === 0) return true;
  const owned = ownedSet(equipment);
  return exercise.equipment.every(item => owned.has(item));
}

const LEVEL_CEILING: Record<string, number> = { beginner: 2, intermediate: 3, advanced: 3 };

/**
 * Everything the user can actually perform, ordered so the engine's first
 * pick is the most appropriate rather than merely the first declared.
 */
export function availableExercises(
  equipment: string[],
  experience: string,
  pattern?: MovementPattern,
): LibraryExercise[] {
  const ceiling = LEVEL_CEILING[experience] ?? 2;
  return EXERCISE_LIBRARY.filter(e =>
    (!pattern || e.pattern === pattern) &&
    isAvailable(e, equipment) &&
    e.level <= ceiling,
  );
}

/** The equipment string persisted on the generated Exercise. */
export function displayEquipment(exercise: LibraryExercise): string {
  return exercise.equipment[0] ?? 'Bodyweight';
}
