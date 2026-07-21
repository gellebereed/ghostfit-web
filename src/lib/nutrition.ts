/**
 * GhostFit — Nutrition data layer (Supabase + target math)
 */
import { supabase } from './supabase';
import {
  ActivityLevel, FoodItem, GroceryList, MealLog, MealPlan, MealPlanDay, NutritionProfile, PlannedMeal,
} from './types';

async function uid(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// ─── Targets (Mifflin-St Jeor) ───────────────────────────────────────────────

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Desk life, little exercise',
  light: 'Light activity 1-3 days/week',
  moderate: 'Training 3-5 days/week',
  active: 'Training 6-7 days/week',
  athlete: 'Physical job + daily training',
};

export function computeTargets(opts: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  activityLevel: ActivityLevel;
  goal: string; // 'shredded' | 'muscle' | 'strength' | 'fitness'
}): { kcal: number; protein: number; carbs: number; fat: number } {
  const { weightKg, heightCm, age, sex, activityLevel, goal } = opts;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];

  const goalAdjustment: Record<string, number> = {
    shredded: -0.18,  // sustainable cut, not a crash
    muscle: 0.10,
    strength: 0.05,
    fitness: 0,
  };
  const kcal = Math.round(tdee * (1 + (goalAdjustment[goal] ?? 0)));

  const proteinPerKg = goal === 'shredded' ? 2.2 : goal === 'muscle' ? 2.0 : 1.8;
  const protein = Math.round(weightKg * proteinPerKg);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

  return { kcal, protein, carbs, fat };
}

// ─── Food catalog (shared cache, exercise_cache pattern) ─────────────────────

export async function getFoodCatalog(countryCode: string, countryName: string): Promise<FoodItem[]> {
  const code = countryCode.toUpperCase();
  const { data } = await supabase
    .from('food_catalogs')
    .select('foods')
    .eq('country_code', code)
    .single();

  if (data?.foods && Array.isArray(data.foods) && data.foods.length > 0) {
    return data.foods as FoodItem[];
  }

  const res = await fetch('/api/food-catalog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryName }),
  });
  if (!res.ok) throw new Error('Could not build the food catalog. Try again.');
  const { foods } = await res.json();

  await supabase.from('food_catalogs').upsert({
    country_code: code,
    country_name: countryName,
    foods,
    cached_at: new Date().toISOString(),
  });
  return foods as FoodItem[];
}

// ─── Nutrition profile ───────────────────────────────────────────────────────

export async function getNutritionProfile(): Promise<NutritionProfile | null> {
  const userId = await uid();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('nutrition_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return {
    countryCode: data.country_code ?? '',
    countryName: data.country_name ?? '',
    sex: data.sex ?? 'male',
    age: data.age ?? 25,
    heightCm: data.height_cm ?? 170,
    activityLevel: data.activity_level ?? 'moderate',
    restrictions: data.restrictions ?? [],
    mealsPerDay: data.meals_per_day ?? 3,
    likedIds: data.foods_liked ?? [],
    tryIds: data.foods_to_try ?? [],
    excludedIds: data.foods_excluded ?? [],
    customFoods: data.custom_foods ?? [],
    targetKcal: data.target_kcal ?? 0,
    targetProtein: data.target_protein ?? 0,
    targetCarbs: data.target_carbs ?? 0,
    targetFat: data.target_fat ?? 0,
    onboardingComplete: data.onboarding_complete ?? false,
    lastCheckinAt: data.last_checkin_at ? new Date(data.last_checkin_at).getTime() : null,
  };
}

export async function saveNutritionProfile(p: NutritionProfile): Promise<boolean> {
  const userId = await uid();
  if (!userId) return false;

  const { error } = await supabase.from('nutrition_profiles').upsert({
    user_id: userId,
    country_code: p.countryCode.toUpperCase(),
    country_name: p.countryName,
    sex: p.sex,
    age: p.age,
    height_cm: p.heightCm,
    activity_level: p.activityLevel,
    restrictions: p.restrictions,
    meals_per_day: p.mealsPerDay,
    foods_liked: p.likedIds,
    foods_to_try: p.tryIds,
    foods_excluded: p.excludedIds,
    custom_foods: p.customFoods,
    target_kcal: p.targetKcal,
    target_protein: p.targetProtein,
    target_carbs: p.targetCarbs,
    target_fat: p.targetFat,
    onboarding_complete: p.onboardingComplete,
    last_checkin_at: p.lastCheckinAt ? new Date(p.lastCheckinAt).toISOString() : null,
  });
  if (error) console.warn('saveNutritionProfile failed:', error.message);
  return !error;
}

// ─── Meal plans ──────────────────────────────────────────────────────────────

export async function saveMealPlan(plan: MealPlan): Promise<void> {
  const userId = await uid();
  if (!userId) return;

  await supabase.from('meal_plans').update({ is_active: false }).eq('user_id', userId);
  await supabase.from('meal_plans').insert({
    user_id: userId,
    week_number: plan.weekNumber,
    days: plan.days,
    is_active: true,
  });
}

export async function getCurrentMealPlan(): Promise<MealPlan | null> {
  const userId = await uid();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    weekNumber: data.week_number,
    days: data.days,
    createdAt: new Date(data.created_at).getTime(),
    groceryList: data.grocery_list ?? null,
  };
}

// ─── Grocery list ────────────────────────────────────────────────────────────

function planItemsHash(plan: MealPlan): string {
  const all = plan.days.flatMap(d => d.meals.flatMap(m => m.items)).join('|');
  let h = 5381;
  for (let i = 0; i < all.length; i++) h = ((h << 5) + h + all.charCodeAt(i)) | 0;
  return String(h);
}

/**
 * Returns the plan's consolidated shopping list, regenerating only when the
 * plan's meals changed (e.g. after a swap). Persisted on the plan row.
 */
export async function getGroceryList(plan: MealPlan, countryName?: string): Promise<GroceryList> {
  const hash = planItemsHash(plan);
  if (plan.groceryList && plan.groceryList.hash === hash) return plan.groceryList;

  const mealItems = plan.days.flatMap(d => d.meals.flatMap(m => m.items));
  const res = await fetch('/api/grocery-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mealItems, countryName }),
  });
  if (!res.ok) throw new Error('Could not build the grocery list. Try again.');
  const { categories } = await res.json();

  const list: GroceryList = { hash, categories };
  if (plan.id) {
    await supabase.from('meal_plans').update({ grocery_list: list }).eq('id', plan.id);
  }
  return list;
}

// ─── Meal logging ────────────────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function logMeal(
  mealIndex: number,
  status: 'ate' | 'skipped',
  macros: { kcal: number; protein: number; carbs: number; fat: number },
  note?: string | null
): Promise<boolean> {
  const userId = await uid();
  if (!userId) return false;

  const { error } = await supabase.from('meal_logs').upsert({
    user_id: userId,
    log_date: todayKey(),
    meal_index: mealIndex,
    status,
    kcal: status === 'ate' ? macros.kcal : 0,
    protein: status === 'ate' ? macros.protein : 0,
    carbs: status === 'ate' ? macros.carbs : 0,
    fat: status === 'ate' ? macros.fat : 0,
    note: note ?? null,
  }, { onConflict: 'user_id,log_date,meal_index' });
  return !error;
}

/** Analyze free-text of an off-plan meal → macros, then log it against the slot. */
export async function logOffPlanMeal(
  mealIndex: number, mealName: string, description: string
): Promise<PlannedMeal> {
  const res = await fetch('/api/analyze-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, mealName }),
  });
  if (!res.ok) throw new Error('Could not analyze that meal. Try describing it more simply.');
  const { meal } = (await res.json()) as { meal: PlannedMeal };
  await logMeal(mealIndex, 'ate', meal, description.slice(0, 200));
  return meal;
}

export async function getTodayLogs(): Promise<MealLog[]> {
  const userId = await uid();
  if (!userId) return [];

  const { data } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', todayKey());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    logDate: r.log_date,
    mealIndex: r.meal_index,
    status: r.status,
    kcal: r.kcal ?? 0,
    protein: r.protein ?? 0,
    carbs: r.carbs ?? 0,
    fat: r.fat ?? 0,
    note: r.note ?? null,
  }));
}

/** Adherence over the past 7 days: meals eaten / meals planned. */
export async function getWeekAdherence(mealsPerDay: number): Promise<number> {
  const userId = await uid();
  if (!userId) return 0;

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const from = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;

  const { data } = await supabase
    .from('meal_logs')
    .select('status')
    .eq('user_id', userId)
    .gte('log_date', from);

  const ate = (data ?? []).filter(r => r.status === 'ate').length;
  const planned = mealsPerDay * 7;
  return planned > 0 ? Math.min(100, Math.round((ate / planned) * 100)) : 0;
}

/** A check-in is due when the active plan is 7+ days old. */
export function isCheckinDue(plan: MealPlan | null): boolean {
  if (!plan) return false;
  return Date.now() - plan.createdAt >= 7 * 86400000;
}

// ─── Recipes (shared cache, exercise_cache pattern) ──────────────────────────

export interface MealRecipe {
  ingredients: string[];
  steps: string[];
  tip: string;
}

function recipeKey(meal: PlannedMeal): string {
  return meal.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export async function getMealRecipe(meal: PlannedMeal, countryName?: string): Promise<MealRecipe> {
  const key = recipeKey(meal);
  const { data } = await supabase
    .from('meal_recipes')
    .select('recipe')
    .eq('recipe_key', key)
    .single();
  if (data?.recipe) return data.recipe as MealRecipe;

  const res = await fetch('/api/meal-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: meal.title, items: meal.items, countryName }),
  });
  if (!res.ok) throw new Error('Could not generate the recipe. Try again.');
  const { recipe } = await res.json();

  await supabase.from('meal_recipes').upsert({
    recipe_key: key,
    title: meal.title,
    recipe,
    cached_at: new Date().toISOString(),
  });
  return recipe as MealRecipe;
}

// ─── Swap a single meal ──────────────────────────────────────────────────────

export async function requestSwapMeal(opts: {
  profile: NutritionProfile;
  catalog: FoodItem[];
  meal: PlannedMeal;
  avoidTitles: string[];
}): Promise<PlannedMeal> {
  const { profile, catalog } = opts;
  const byId = new Map<string, FoodItem>();
  [...catalog, ...profile.customFoods].forEach(f => byId.set(f.id, f));
  const liked = profile.likedIds.map(id => byId.get(id)).filter(Boolean) as FoodItem[];

  const res = await fetch('/api/swap-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      countryName: profile.countryName,
      mealName: opts.meal.name,
      avoidTitles: opts.avoidTitles,
      targetKcal: opts.meal.kcal,
      targetProtein: opts.meal.protein,
      likedFoods: liked.map(foodLabel),
      restrictions: profile.restrictions,
    }),
  });
  if (!res.ok) throw new Error('Could not build a new option. Try again.');
  const { meal } = await res.json();
  return meal as PlannedMeal;
}

/** Persist a full day-set of meals for a plan (used by rebalance). */
export async function saveMealPlanDays(planId: string | undefined, days: MealPlanDay[]): Promise<void> {
  if (!planId) return;
  await supabase.from('meal_plans').update({ days }).eq('id', planId);
}

/** Persist a replaced meal into the active plan. */
export async function replaceMealInPlan(
  plan: MealPlan, dayIndex: number, mealIndex: number, newMeal: PlannedMeal
): Promise<MealPlan> {
  const days = plan.days.map((d, di) => di !== dayIndex ? d : {
    ...d,
    meals: d.meals.map((m, mi) => mi === mealIndex ? newMeal : m),
  });
  if (plan.id) {
    await supabase.from('meal_plans').update({ days }).eq('id', plan.id);
  }
  return { ...plan, days };
}

// ─── Plan generation helpers ─────────────────────────────────────────────────

export function foodLabel(f: FoodItem): string {
  return `${f.name} (${f.serving}: ${f.kcal} kcal, ${f.protein}g protein)`;
}

export async function requestMealPlan(opts: {
  profile: NutritionProfile;
  goal: string;
  catalog: FoodItem[];
  weekNumber: number;
  adaptation?: { adherencePercent: number; weightChangeKg: number; energyLevel: number };
}): Promise<MealPlan> {
  const { profile, catalog } = opts;
  const byId = new Map<string, FoodItem>();
  [...catalog, ...profile.customFoods].forEach(f => byId.set(f.id, f));

  const liked = profile.likedIds.map(id => byId.get(id)).filter(Boolean) as FoodItem[];
  const toTry = profile.tryIds.map(id => byId.get(id)).filter(Boolean) as FoodItem[];

  const res = await fetch('/api/generate-meal-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      countryName: profile.countryName,
      goal: opts.goal,
      targetKcal: profile.targetKcal,
      targetProtein: profile.targetProtein,
      targetCarbs: profile.targetCarbs,
      targetFat: profile.targetFat,
      mealsPerDay: profile.mealsPerDay,
      likedFoods: liked.map(foodLabel),
      tryFoods: toTry.map(foodLabel),
      restrictions: profile.restrictions,
      weekNumber: opts.weekNumber,
      adaptation: opts.adaptation,
    }),
  });
  if (!res.ok) throw new Error('Meal plan generation failed. Try again.');
  return res.json();
}
