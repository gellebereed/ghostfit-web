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

// ─── Food catalog (shared cache with rich fallback) ─────────────────────

export const DEFAULT_GLOBAL_FOODS: FoodItem[] = [
  // Proteins
  { id: 'chicken-breast', name: 'Grilled Chicken Breast', category: 'protein', serving: '100g cooked', kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: 'eggs-large', name: 'Whole Eggs', category: 'protein', serving: '2 large eggs', kcal: 140, protein: 12, carbs: 1, fat: 10 },
  { id: 'egg-whites', name: 'Egg Whites', category: 'protein', serving: '100g', kcal: 52, protein: 11, carbs: 0.7, fat: 0.2 },
  { id: 'salmon-fillet', name: 'Salmon Fillet', category: 'protein', serving: '100g cooked', kcal: 206, protein: 22, carbs: 0, fat: 12 },
  { id: 'lean-beef', name: 'Lean Ground Beef (90%)', category: 'protein', serving: '100g cooked', kcal: 215, protein: 26, carbs: 0, fat: 11 },
  { id: 'tuna-canned', name: 'Canned Tuna in Water', category: 'protein', serving: '100g drained', kcal: 116, protein: 26, carbs: 0, fat: 1 },
  { id: 'tofu-firm', name: 'Firm Tofu', category: 'protein', serving: '100g', kcal: 144, protein: 17, carbs: 3, fat: 8 },
  { id: 'turkey-breast', name: 'Roasted Turkey Breast', category: 'protein', serving: '100g cooked', kcal: 135, protein: 30, carbs: 0, fat: 1 },
  { id: 'red-lentils', name: 'Cooked Lentils', category: 'protein', serving: '1 cup (198g)', kcal: 230, protein: 18, carbs: 40, fat: 0.8 },
  { id: 'whey-protein', name: 'Whey Protein Powder', category: 'protein', serving: '1 scoop (30g)', kcal: 120, protein: 24, carbs: 2, fat: 1.5 },
  { id: 'tilapia-fillet', name: 'White Fish (Tilapia/Cod)', category: 'protein', serving: '100g cooked', kcal: 96, protein: 20, carbs: 0, fat: 1.7 },

  // Carbs
  { id: 'white-rice', name: 'White Rice', category: 'carb', serving: '1 cup cooked (158g)', kcal: 205, protein: 4.2, carbs: 45, fat: 0.4 },
  { id: 'brown-rice', name: 'Brown Rice', category: 'carb', serving: '1 cup cooked (195g)', kcal: 218, protein: 4.5, carbs: 46, fat: 1.6 },
  { id: 'rolled-oats', name: 'Rolled Oatmeal', category: 'carb', serving: '1/2 cup dry (40g)', kcal: 150, protein: 5, carbs: 27, fat: 2.5 },
  { id: 'sweet-potato', name: 'Baked Sweet Potato', category: 'carb', serving: '1 medium (114g)', kcal: 103, protein: 2.3, carbs: 24, fat: 0.2 },
  { id: 'white-potato', name: 'Boiled White Potato', category: 'carb', serving: '1 medium (150g)', kcal: 130, protein: 3, carbs: 29, fat: 0.2 },
  { id: 'whole-wheat-bread', name: 'Whole Wheat Bread', category: 'carb', serving: '2 slices (56g)', kcal: 140, protein: 6, carbs: 24, fat: 2 },
  { id: 'quinoa-cooked', name: 'Cooked Quinoa', category: 'carb', serving: '1 cup (185g)', kcal: 222, protein: 8, carbs: 39, fat: 3.6 },
  { id: 'pasta-cooked', name: 'Cooked Pasta', category: 'carb', serving: '1 cup (140g)', kcal: 220, protein: 8, carbs: 43, fat: 1.3 },
  { id: 'injera-bread', name: 'Traditional Flatbread / Injera', category: 'carb', serving: '1 large piece (150g)', kcal: 240, protein: 7, carbs: 50, fat: 1 },
  { id: 'pita-bread', name: 'Whole Wheat Pita', category: 'carb', serving: '1 pita (60g)', kcal: 170, protein: 6, carbs: 35, fat: 1 },

  // Vegetables
  { id: 'steamed-broccoli', name: 'Fresh Broccoli', category: 'vegetable', serving: '1 cup (91g)', kcal: 31, protein: 2.5, carbs: 6, fat: 0.3 },
  { id: 'spinach-fresh', name: 'Fresh Spinach', category: 'vegetable', serving: '2 cups (60g)', kcal: 14, protein: 1.7, carbs: 2.2, fat: 0.2 },
  { id: 'mixed-salad', name: 'Mixed Salad Greens', category: 'vegetable', serving: '2 cups (100g)', kcal: 20, protein: 1.5, carbs: 3.5, fat: 0.2 },
  { id: 'sweet-corn', name: 'Sweet Corn', category: 'vegetable', serving: '1/2 cup (82g)', kcal: 66, protein: 2.3, carbs: 15, fat: 0.8 },
  { id: 'ripe-tomatoes', name: 'Fresh Tomatoes', category: 'vegetable', serving: '1 medium (123g)', kcal: 22, protein: 1.1, carbs: 4.8, fat: 0.2 },
  { id: 'cucumbers', name: 'Sliced Cucumber', category: 'vegetable', serving: '1 cup (104g)', kcal: 16, protein: 0.7, carbs: 3.8, fat: 0.1 },

  // Fruits
  { id: 'fresh-banana', name: 'Fresh Banana', category: 'fruit', serving: '1 medium (118g)', kcal: 105, protein: 1.3, carbs: 27, fat: 0.3 },
  { id: 'red-apple', name: 'Fresh Apple', category: 'fruit', serving: '1 medium (182g)', kcal: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { id: 'sweet-berries', name: 'Mixed Berries', category: 'fruit', serving: '1 cup (150g)', kcal: 80, protein: 1, carbs: 18, fat: 0.5 },
  { id: 'juicy-orange', name: 'Fresh Orange', category: 'fruit', serving: '1 medium (131g)', kcal: 62, protein: 1.2, carbs: 15, fat: 0.2 },

  // Dairy
  { id: 'greek-yogurt', name: 'Plain Greek Yogurt (0%)', category: 'dairy', serving: '1 cup (200g)', kcal: 120, protein: 20, carbs: 7, fat: 0 },
  { id: 'cottage-cheese', name: 'Low-Fat Cottage Cheese', category: 'dairy', serving: '1/2 cup (113g)', kcal: 90, protein: 14, carbs: 5, fat: 1.5 },
  { id: 'cow-milk', name: 'Whole Milk', category: 'dairy', serving: '1 cup (244ml)', kcal: 149, protein: 8, carbs: 12, fat: 8 },

  // Fats & Snacks
  { id: 'raw-almonds', name: 'Raw Almonds', category: 'fat', serving: '1 oz (28g / ~23 nuts)', kcal: 164, protein: 6, carbs: 6, fat: 14 },
  { id: 'peanut-butter', name: 'Natural Peanut Butter', category: 'fat', serving: '2 tbsp (32g)', kcal: 190, protein: 8, carbs: 7, fat: 16 },
  { id: 'extra-virgin-olive-oil', name: 'Extra Virgin Olive Oil', category: 'fat', serving: '1 tbsp (15ml)', kcal: 119, protein: 0, carbs: 0, fat: 13.5 },
  { id: 'ripe-avocado', name: 'Fresh Avocado', category: 'fat', serving: '1/2 avocado (100g)', kcal: 160, protein: 2, carbs: 8.5, fat: 14.7 },
];

export async function getFoodCatalog(countryCode: string, countryName: string): Promise<FoodItem[]> {
  const code = countryCode.toUpperCase();
  try {
    const { data } = await supabase
      .from('food_catalogs')
      .select('foods')
      .eq('country_code', code)
      .single();

    if (data?.foods && Array.isArray(data.foods) && data.foods.length > 0) {
      return data.foods as FoodItem[];
    }
  } catch {
    // Continue to API fetch if database query fails
  }

  try {
    const res = await fetch('/api/food-catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryName }),
    });

    if (res.ok) {
      const { foods } = await res.json();
      if (Array.isArray(foods) && foods.length > 0) {
        try {
          await supabase.from('food_catalogs').upsert({
            country_code: code,
            country_name: countryName,
            foods,
            cached_at: new Date().toISOString(),
          });
        } catch { /* ignore cache write errors */ }
        return foods as FoodItem[];
      }
    }
  } catch (err) {
    console.warn('Food catalog fetch notice, using fallback catalog:', err);
  }

  // Resilient Fallback: Return default global foods catalog
  return DEFAULT_GLOBAL_FOODS;
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
