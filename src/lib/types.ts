// GhostFit TypeScript Types

export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  equipment: string;
  type: 'strength' | 'cardio';
  metricType: 'weight_reps' | 'bodyweight_reps' | 'duration' | 'cardio' | 'reps_only';
  durationSeconds: number | null;

  // ── Program-engine fields (optional: legacy plans predate them) ──────────
  /** Stable library id — lets the engine recognise its own picks on re-read. */
  libraryId?: string;
  /** Prescribed rest between sets, in seconds. */
  restSeconds?: number;
  /** Reps left in the tank at the end of a set. Lower = closer to failure. */
  targetRir?: number;
  /** Eccentric-pause-concentric-pause, e.g. "3-1-1-0". */
  tempo?: string;
  /** Inclusive rep window for double progression. */
  repMin?: number;
  repMax?: number;
  /** Ramp-up sets before the working sets (heavy compounds only). */
  warmupSets?: number;
  movementPattern?: MovementPattern;
  primaryMuscles?: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  block?: ExerciseBlock;
  /** One-line technique or intent cue shown during the set. */
  coachNote?: string;
  /** Shared token = perform back to back with minimal rest. */
  supersetGroup?: string;
}

export interface WorkoutDay {
  dayNumber: number;
  dayName: string;
  focus: string;
  isRest: boolean;
  exercises: Exercise[];

  // ── Program-engine fields ────────────────────────────────────────────────
  sessionType?: 'strength' | 'conditioning' | 'active_recovery' | 'rest';
  warmup?: WarmupStep[];
  cooldown?: CooldownStep[];
  estimatedMinutes?: number;
  /** 'Heavy' | 'Moderate' | 'Light' — sets expectation before they start. */
  intensityLabel?: string;
  targetMuscles?: MuscleGroup[];
  coachNote?: string;
}

export interface WorkoutPlan {
  weekNumber: number;
  days: WorkoutDay[];
  createdAt: number;
  meta?: PlanMeta;
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
  soulCoins: number;
  unlockedCosmetics: string[];
  equippedCosmetics: Record<string, string>;
  
  // New metrics & streaks
  weight_kg: number;
  current_streak: number;

  // Psychology engine
  streakShields?: number;
  shieldedDates?: string[];       // toDateString() entries of loss-days a shield absorbed
  commitmentTime?: string | null; // "HH:MM" — the time the user promised to train

  // New Avatar fields
  characterStyle?: string;
  auraColor?: string;
  characterName?: string;
  ghostStyle?: string;
  ghostAuraColor?: string;
  ghostName?: string;
  usesCustomAvatar?: boolean;
  customAvatarDataUrl?: string;
  usesCustomGhost?: boolean;
  customGhostDataUrl?: string;
}

export interface ExerciseInfo {
  name: string;
  gifUrl: string;
  instructions: string[];
  bodyPart: string;
  youtubeVideoId?: string;
}

// ─── Quests Layer ────────────────────────────────────────────────────────────

export type QuestType = 'north_star' | 'quarterly' | 'monthly';

export const QUEST_TYPE_META: Record<QuestType, { label: string; emoji: string; reward: number }> = {
  north_star: { label: 'Yearly North Star', emoji: '🌟', reward: 500 },
  quarterly:  { label: 'Quarterly Theme',   emoji: '🗺️', reward: 200 },
  monthly:    { label: 'Monthly Milestone', emoji: '🎯', reward: 100 },
};

export const TASK_PRIORITY_META: Record<number, { label: string; color: string; reward: number }> = {
  1: { label: '🔥 P1', color: '#FF4444', reward: 10 },
  2: { label: 'P2',    color: '#FFD700', reward: 5 },
  3: { label: 'P3',    color: '#A0A0A0', reward: 3 },
};

export interface Quest {
  id: string;
  parentId: string | null;
  title: string;
  why: string;
  questType: QuestType;
  status: 'active' | 'done' | 'killed';
  targetDate: string | null;   // YYYY-MM-DD
  createdAt: number;
  completedAt: number | null;
  tasks: QuestTask[];
}

export interface QuestTask {
  id: string;
  questId: string | null;      // null = inbox
  title: string;
  note: string | null;
  priority: number;            // 1-3
  doDate: string | null;       // YYYY-MM-DD
  isDone: boolean;
  doneAt: number | null;
  sortOrder: number;
}

// ─── Nutrition Layer ─────────────────────────────────────────────────────────

export type FoodCategory = 'protein' | 'carb' | 'vegetable' | 'fruit' | 'dairy' | 'fat' | 'snack' | 'drink';

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  protein: '🍗 Proteins',
  carb: '🍚 Carbs & Grains',
  vegetable: '🥦 Vegetables',
  fruit: '🍌 Fruits',
  dairy: '🥛 Dairy',
  fat: '🥑 Fats & Nuts',
  snack: '🍫 Snacks',
  drink: '🥤 Drinks',
};

export interface FoodItem {
  id: string;            // kebab-case slug
  name: string;
  category: FoodCategory;
  serving: string;       // e.g. "100g cooked", "1 cup"
  kcal: number;
  protein: number;       // grams per serving
  carbs: number;
  fat: number;
  isCustom?: boolean;
}

export type FoodPreference = 'like' | 'try' | 'exclude';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';

export interface NutritionProfile {
  countryCode: string;
  countryName: string;
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  restrictions: string[];
  mealsPerDay: number;
  likedIds: string[];
  tryIds: string[];
  excludedIds: string[];
  customFoods: FoodItem[];
  targetKcal: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  onboardingComplete: boolean;
  lastCheckinAt: number | null;
}

export interface PlannedMeal {
  name: string;          // e.g. "Breakfast"
  title: string;         // e.g. "Injera with Shiro"
  items: string[];       // e.g. ["1 medium injera", "150g shiro stew"]
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlanDay {
  dayNumber: number;     // 1-7
  meals: PlannedMeal[];
}

export interface GroceryItem {
  name: string;
  quantity: string;    // e.g. "1.2 kg", "3 pieces"
}

export interface GroceryCategory {
  name: string;
  emoji: string;
  items: GroceryItem[];
}

export interface GroceryList {
  hash: string;        // hash of plan items — detects staleness after meal swaps
  categories: GroceryCategory[];
}

export interface MealPlan {
  id?: string;
  weekNumber: number;
  days: MealPlanDay[];
  createdAt: number;
  groceryList?: GroceryList | null;
}

export interface MealLog {
  logDate: string;       // YYYY-MM-DD
  mealIndex: number;
  status: 'ate' | 'skipped';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  note?: string | null;  // set when the user ate something off-plan
}

// ─── Social Layer ────────────────────────────────────────────────────────────

export interface FriendInfo {
  userId: string;
  characterName: string;
  characterStyle?: string;
  auraColor?: string;
  currentStreak: number;
  friendshipId: string;
}

export interface FriendRequest {
  friendshipId: string;
  userId: string;         // the other party
  characterName: string;
  characterStyle?: string;
  auraColor?: string;
  direction: 'incoming' | 'outgoing';
}

export type ChallengeMetric = 'total_reps' | 'sets' | 'workouts';

export const METRIC_LABELS: Record<ChallengeMetric, string> = {
  total_reps: 'Total Reps',
  sets: 'Sets Completed',
  workouts: 'Workout Days',
};

export interface Challenge {
  id: string;
  creatorId: string;
  opponentId: string | null;      // null = shadow challenge (you vs your best self)
  metric: ChallengeMetric;
  durationDays: number;
  wagerCoins: number;
  status: 'pending' | 'active' | 'declined' | 'completed';
  startsAt: number | null;
  endsAt: number | null;
  shadowBaseline: number;
  winnerId: string | null;
  creatorSettled: boolean;
  opponentSettled: boolean;
  createdAt: number;
  // Embedded profile of the *other* participant (null for shadow)
  opponentProfile: {
    characterName: string;
    characterStyle?: string;
    auraColor?: string;
  } | null;
}

export interface ChallengeScores {
  mine: number;
  theirs: number;   // shadow baseline for shadow challenges
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

// ─── Training Science Layer ──────────────────────────────────────────────────
// Added by the program engine. Every field is optional on the existing
// interfaces above so plans generated before the engine still load.

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/** The nine fundamental human movement patterns a balanced program covers. */
export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'carry'
  | 'core_anti_extension'
  | 'core_anti_rotation'
  | 'core_flexion'
  | 'isolation_arm'
  | 'isolation_shoulder'
  | 'isolation_leg'
  | 'calf'
  | 'conditioning';

export type MuscleGroup =
  | 'chest' | 'back' | 'lats' | 'traps' | 'shoulders' | 'rear_delts'
  | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'adductors' | 'calves'
  | 'core' | 'obliques' | 'lower_back' | 'hip_flexors'
  | 'heart';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Upper Back', lats: 'Lats', traps: 'Traps',
  shoulders: 'Shoulders', rear_delts: 'Rear Delts',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  adductors: 'Adductors', calves: 'Calves',
  core: 'Core', obliques: 'Obliques', lower_back: 'Lower Back',
  hip_flexors: 'Hip Flexors', heart: 'Cardiovascular',
};

/** Where an exercise sits in the session — drives ordering and rest length. */
export type ExerciseBlock =
  | 'primary'      // heaviest compound, done fresh
  | 'secondary'    // second compound
  | 'accessory'    // isolation / smaller compound
  | 'core'
  | 'conditioning'
  | 'finisher';

/** RAMP protocol stages — Raise, Activate, Mobilise, Potentiate. */
export type WarmupStage = 'raise' | 'mobilise' | 'activate' | 'potentiate';

export interface WarmupStep {
  id: string;
  name: string;
  stage: WarmupStage;
  durationSeconds: number;
  reps: number | null;
  perSide: boolean;
  cue: string;
  targets: MuscleGroup[];
}

export type CooldownKind = 'breathing' | 'static' | 'foam_roll';

export interface CooldownStep {
  id: string;
  name: string;
  kind: CooldownKind;
  holdSeconds: number;
  perSide: boolean;
  cue: string;
  /** Why this stretch is here — the "I don't know what to do after" answer. */
  relief: string;
  targets: MuscleGroup[];
}

export type TrainingPhase =
  | 'foundation'       // week 1 of a brand-new program — technique + tissue prep
  | 'accumulation'     // volume climbs
  | 'intensification'  // volume holds, intensity climbs
  | 'deload'           // planned recovery week
  | 'reentry';         // returning after a layoff

export const PHASE_META: Record<TrainingPhase, { label: string; emoji: string; blurb: string }> = {
  foundation:      { label: 'Foundation',      emoji: '🧱', blurb: 'Groove the patterns. Leave reps in the tank.' },
  accumulation:    { label: 'Accumulation',    emoji: '📈', blurb: 'Volume climbs. This is where growth is bought.' },
  intensification: { label: 'Intensification', emoji: '🔥', blurb: 'Same volume, heavier bar. Push closer to failure.' },
  deload:          { label: 'Deload',          emoji: '🌙', blurb: 'Planned recovery. Half the work, all the adaptation.' },
  reentry:         { label: 'Re-entry',        emoji: '🌱', blurb: 'Rebuilding after time off. Soreness control first.' },
};

export interface PlanMeta {
  engineVersion: number;
  splitId: string;
  splitName: string;
  splitRationale: string;
  goal: string;
  experience: ExperienceLevel;
  trainingDays: number;
  sessionMinutes: number;
  /** Position inside the current mesocycle (1-indexed). */
  mesocycleWeek: number;
  mesocycleLength: number;
  phase: TrainingPhase;
  isDeload: boolean;
  volumeMultiplier: number;
  intensityMultiplier: number;
  /** Hard sets per muscle group across the week — the volume audit. */
  weeklySets: Partial<Record<MuscleGroup, number>>;
  coachNotes: string[];
  /** Set when the plan was rebuilt by the layoff engine. */
  reentryFromDaysOff?: number;
}
