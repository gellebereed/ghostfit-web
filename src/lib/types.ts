// GhostFit TypeScript Types

export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  equipment: string;
  type: 'strength' | 'cardio';
  metricType: 'weight_reps' | 'bodyweight_reps' | 'duration' | 'cardio' | 'reps_only';
  durationSeconds: number | null;
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

export interface MealPlan {
  id?: string;
  weekNumber: number;
  days: MealPlanDay[];
  createdAt: number;
}

export interface MealLog {
  logDate: string;       // YYYY-MM-DD
  mealIndex: number;
  status: 'ate' | 'skipped';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
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
