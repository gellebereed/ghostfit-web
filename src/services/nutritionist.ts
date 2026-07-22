/**
 * GhostFit — AI Nutritionist (server-side)
 *
 * Voice note: the nutritionist is the SUPPORTIVE coach persona — the ghost
 * taunts, the nutritionist never does. Keep generated copy encouraging.
 */
import { FoodItem, GroceryCategory, MealPlan, PlannedMeal } from '@/lib/types';
import { generateJSON } from './llm';

export async function generateGroceryList(
  mealItems: string[], countryName?: string
): Promise<GroceryCategory[]> {
  const prompt = `You are a practical meal-prep assistant${countryName ? ` in ${countryName}` : ''}.
Below are ALL the meal components for one week of eating. Consolidate them into
a single shopping list.

Rules:
- MERGE duplicates and SUM quantities across the week ("150g chicken" seven
  times = "~1.1 kg chicken breast"). Round to amounts people actually buy.
- Group into sensible aisles. Use these category names with emoji:
  Proteins 🍗, Grains & Carbs 🍚, Vegetables 🥦, Fruits 🍌, Dairy 🥛,
  Pantry & Spices 🧂 — omit any empty category, add another only if truly needed.
- Skip water. Include cooking oil/basic seasonings once under Pantry & Spices.
- Every item: short buyable name + one total quantity.

Return ONLY valid JSON:
{ "categories": [ { "name": "Proteins", "emoji": "🍗",
    "items": [ { "name": "Chicken breast", "quantity": "1.1 kg" } ] } ] }`;

  const parsed = await generateJSON<{ categories: GroceryCategory[] }>({
    system: prompt,
    user: `Week's meal components:\n${mealItems.join('\n')}`,
    maxTokens: 4096,
    validate: p => Array.isArray(p?.categories) && p.categories.length >= 2 &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p.categories.every((c: any) => c?.name && Array.isArray(c?.items) && c.items.length > 0),
  });
  return parsed.categories.map(c => ({
    name: String(c.name),
    emoji: String(c.emoji ?? '🛒'),
    items: c.items.map(i => ({ name: String(i.name), quantity: String(i.quantity ?? '') })),
  }));
}

export interface MealRecipe {
  ingredients: string[];
  steps: string[];
  tip: string;
}

export async function generateRecipe(title: string, items: string[], countryName?: string): Promise<MealRecipe> {
  const prompt = `You are a warm, practical home-cooking coach${countryName ? ` familiar with ${countryName} kitchens` : ''}.
Write a simple recipe for this meal. Assume a basic kitchen and a busy person.

Return ONLY valid JSON:
{
  "ingredients": ["exact quantity + ingredient", ...],
  "steps": ["short imperative step", ...],   // 4-8 steps, each one action
  "tip": "one sentence that makes it tastier or faster"
}`;

  const parsed = await generateJSON<MealRecipe>({
    system: prompt,
    user: `Meal: ${title}\nComponents: ${items.join('; ')}`,
    maxTokens: 2048,
    validate: p => Array.isArray(p?.ingredients) && p.ingredients.length >= 1 &&
      Array.isArray(p?.steps) && p.steps.length >= 3,
  });
  return {
    ingredients: parsed.ingredients.map(String),
    steps: parsed.steps.map(String),
    tip: String(parsed.tip ?? ''),
  };
}

/**
 * Analyze free-text of what the user actually ate → macros.
 * Deliberately tiny (short prompt, low token cap) — called on demand only.
 */
export async function analyzeMeal(description: string, mealName: string): Promise<PlannedMeal> {
  const prompt = `Estimate nutrition for what the user ate. Be realistic; if amounts
are vague, assume a normal portion. Return ONLY JSON:
{ "title": "short name of the meal", "items": ["item as stated"],
  "kcal": 0, "protein": 0, "carbs": 0, "fat": 0 }`;

  const parsed = await generateJSON<PlannedMeal>({
    system: prompt,
    user: description.slice(0, 400),
    maxTokens: 500,
    validate: p => typeof p?.title === 'string' && Number(p?.kcal) >= 0 && p?.kcal !== undefined,
  });
  return {
    name: mealName,
    title: String(parsed.title || description.slice(0, 40)),
    items: Array.isArray(parsed.items) ? parsed.items.map(String) : [description],
    kcal: Math.max(0, Math.round(Number(parsed.kcal) || 0)),
    protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(parsed.fat) || 0)),
  };
}

export interface SwapMealRequest {
  countryName: string;
  mealName: string;        // Breakfast / Lunch / Snack / Dinner
  avoidTitles: string[];   // titles already in the plan (don't repeat)
  targetKcal: number;
  targetProtein: number;
  likedFoods: string[];
  restrictions: string[];
}

export async function swapMealOption(req: SwapMealRequest): Promise<PlannedMeal> {
  const prompt = `You are a world-class nutritionist in ${req.countryName}. The client wants a
DIFFERENT option for one meal — same nutrition, new dish.

Requirements:
- Meal slot: ${req.mealName}
- Hit ${req.targetKcal} kcal (±8%) and ${req.targetProtein}g protein (±5g)
- Build ONLY from these foods (plus basic seasonings/oil): ${req.likedFoods.join('; ')}
- NEVER violate: ${req.restrictions.length ? req.restrictions.join(', ') : 'no restrictions'}
- Must be clearly different from: ${req.avoidTitles.join(' | ') || 'nothing'}
- Concrete quantities on every item

Return ONLY valid JSON:
{ "name": "${req.mealName}", "title": "Appetizing Dish Name",
  "items": ["quantity + food", ...], "kcal": 0, "protein": 0, "carbs": 0, "fat": 0 }`;

  const parsed = await generateJSON<PlannedMeal>({
    system: prompt,
    user: 'Give me a different option for this meal',
    maxTokens: 1536,
    validate: p => typeof p?.title === 'string' && Array.isArray(p?.items) && p.items.length >= 1 &&
      Number(p?.kcal) > 0,
  });
  return {
    name: req.mealName,
    title: String(parsed.title),
    items: parsed.items.map(String),
    kcal: Math.max(0, Math.round(Number(parsed.kcal) || 0)),
    protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(parsed.fat) || 0)),
  };
}

const VALID_CATEGORIES = ['protein', 'carb', 'vegetable', 'fruit', 'dairy', 'fat', 'snack', 'drink'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeFood(f: any): FoodItem | null {
  if (!f?.name) return null;
  const id = (f.id || f.name).toString().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id,
    name: String(f.name),
    category: VALID_CATEGORIES.includes(f.category) ? f.category : 'snack',
    serving: String(f.serving || '100g'),
    kcal: Math.max(0, Math.round(Number(f.kcal) || 0)),
    protein: Math.max(0, Math.round(Number(f.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(f.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(f.fat) || 0)),
  };
}

export async function generateFoodCatalog(countryName: string): Promise<FoodItem[]> {
  const prompt = `You are a world-class nutritionist with deep knowledge of local
food culture in every country. Build a food catalog for a user in ${countryName}.

Rules:
- 60-75 foods, ALL commonly available and affordable in ${countryName}
- Prioritize genuine local staples and traditional dishes people actually eat
  there (use the local dish names, with an English hint in parentheses when the
  name alone is unclear), plus internationally common basics available there
- Cover every category: protein, carb, vegetable, fruit, dairy, fat, snack, drink
- At least 12 protein sources and 12 carb sources
- Macros are per the stated serving, realistic, from standard nutrition data
- serving must be a concrete measure: "100g cooked", "1 medium piece", "1 cup"

Return ONLY valid JSON:
{
  "foods": [
    { "id": "kebab-slug", "name": "Food Name", "category": "protein",
      "serving": "100g cooked", "kcal": 165, "protein": 31, "carbs": 0, "fat": 4 }
  ]
}`;

  const parsed = await generateJSON<{ foods: unknown[] }>({
    system: prompt,
    user: `Build the ${countryName} food catalog`,
    maxTokens: 16384,
    validate: p => Array.isArray(p?.foods) && p.foods.length >= 5,
  });
  const foods = (parsed.foods ?? [])
    .map(sanitizeFood)
    .filter(Boolean) as FoodItem[];
  // De-dup by id
  const seen = new Set<string>();
  return foods.filter(f => (seen.has(f.id) ? false : (seen.add(f.id), true)));
}

export async function estimateFood(name: string, serving?: string): Promise<FoodItem | null> {
  const prompt = `You are a nutritionist estimating macros for a food the user
entered manually. Give realistic values from standard nutrition data. If the
food name is not recognizable as food, return {"error": "not_food"}.

Return ONLY valid JSON:
{ "id": "kebab-slug", "name": "Cleaned Up Name", "category": "protein|carb|vegetable|fruit|dairy|fat|snack|drink",
  "serving": "${serving || 'a sensible standard serving'}", "kcal": 0, "protein": 0, "carbs": 0, "fat": 0 }`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = await generateJSON<any>({
    system: prompt,
    user: `Food: ${name}${serving ? ` — serving: ${serving}` : ''}`,
    maxTokens: 1024,
    validate: p => p?.error === 'not_food' || (typeof p?.name === 'string' && typeof p?.kcal === 'number'),
  });
  if (parsed.error) return null;
  const food = sanitizeFood(parsed);
  if (food) food.isCustom = true;
  return food;
}

export interface RebalanceRequest {
  countryName: string;
  remainingMeals: string[];   // meal slot names still to eat, e.g. ["Lunch","Dinner"]
  remainingKcal: number;      // budget left for the day
  remainingProtein: number;
  likedFoods: string[];
  restrictions: string[];
}

/** Regenerate only the not-yet-eaten meals to fit the day's remaining budget. One call. */
export async function rebalanceDay(req: RebalanceRequest): Promise<PlannedMeal[]> {
  const perMeal = Math.max(1, req.remainingMeals.length);
  const prompt = `You are a nutritionist rescuing a day that went off-plan in ${req.countryName}.
The user has ${req.remainingKcal} kcal and ${req.remainingProtein}g protein left for the
rest of today across these meals: ${req.remainingMeals.join(', ')}.

Rules:
- The ${req.remainingMeals.length} meals together must total close to the remaining budget
  (±8% kcal). If the budget is very low, make light meals — that's the point.
- Build ONLY from: ${req.likedFoods.join('; ')}
- NEVER violate: ${req.restrictions.length ? req.restrictions.join(', ') : 'no restrictions'}
- Concrete quantities on every item.

Return ONLY JSON:
{ "meals": [ { "name": "${req.remainingMeals[0] ?? 'Meal'}", "title": "Dish",
  "items": ["qty + food"], "kcal": 0, "protein": 0, "carbs": 0, "fat": 0 } ] }
Exactly ${perMeal} meals, one per slot in order.`;

  const parsed = await generateJSON<{ meals: PlannedMeal[] }>({
    system: prompt,
    user: 'Rebalance the rest of my day',
    maxTokens: 2048,
    validate: p => Array.isArray(p?.meals) && p.meals.length === perMeal,
  });
  return parsed.meals.map((m, i) => ({
    name: req.remainingMeals[i] ?? String(m.name ?? 'Meal'),
    title: String(m.title ?? 'Meal'),
    items: Array.isArray(m.items) ? m.items.map(String) : [],
    kcal: Math.max(0, Math.round(Number(m.kcal) || 0)),
    protein: Math.max(0, Math.round(Number(m.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(m.carbs) || 0)),
    fat: Math.max(0, Math.round(Number(m.fat) || 0)),
  }));
}

export interface MealPlanRequest {
  countryName: string;
  goal: string;
  targetKcal: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  mealsPerDay: number;
  likedFoods: string[];    // names w/ servings
  tryFoods: string[];
  restrictions: string[];
  weekNumber: number;
  adaptation?: {
    adherencePercent: number;
    weightChangeKg: number;
    energyLevel: number;   // 1-5
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeMealPlan(raw: any, weekNumber: number): MealPlan {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const days = (Array.isArray(raw.days) ? raw.days : []).slice(0, 7).map((d: any, i: number) => ({
    dayNumber: i + 1,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    meals: (Array.isArray(d.meals) ? d.meals : []).map((m: any) => ({
      name: String(m.name || 'Meal'),
      title: String(m.title || m.name || 'Meal'),
      items: Array.isArray(m.items) ? m.items.map(String) : [],
      kcal: Math.max(0, Math.round(Number(m.kcal) || 0)),
      protein: Math.max(0, Math.round(Number(m.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(m.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(m.fat) || 0)),
    })),
  }));
  return { weekNumber, days, createdAt: Date.now() };
}

export async function generateMealPlan(req: MealPlanRequest): Promise<MealPlan> {
  const adaptationBlock = req.adaptation ? `
ADAPTATION — this is week ${req.weekNumber}, adjust from last week's results:
- Meal adherence last week: ${req.adaptation.adherencePercent}%
- Weight change: ${req.adaptation.weightChangeKg > 0 ? '+' : ''}${req.adaptation.weightChangeKg.toFixed(1)} kg
- Self-reported energy: ${req.adaptation.energyLevel}/5
Adaptation rules:
- Adherence < 60%: simplify — fewer ingredients, easier prep, more of their favorite foods. Do NOT lecture.
- Goal is fat loss but weight flat/up with high adherence: reduce daily kcal by ~150
- Goal is muscle but weight flat with high adherence: increase daily kcal by ~150
- Energy ≤ 2: shift more carbs to earlier meals and around training
` : '';

  const prompt = `You are a world-class nutritionist in ${req.countryName} building a
7-day meal plan. You are warm and encouraging — meal titles and food choices
should feel like a treat, not a punishment.

CLIENT:
- Fitness goal: ${req.goal}
- Daily targets: ${req.targetKcal} kcal, ${req.targetProtein}g protein, ${req.targetCarbs}g carbs, ${req.targetFat}g fat
- Meals per day: ${req.mealsPerDay}
- Dietary restrictions (NEVER violate): ${req.restrictions.length ? req.restrictions.join(', ') : 'none'}

FOODS THE CLIENT LIKES (build ~85% of the plan from these):
${req.likedFoods.join('; ')}

FOODS THE CLIENT WANTS TO TRY (sprinkle in 2-4 times across the week as highlights):
${req.tryFoods.length ? req.tryFoods.join('; ') : 'none'}
${adaptationBlock}
RULES:
1. ONLY use foods from the lists above (plus basic seasonings/oil). This is the
   most important rule — the client chose these foods because they are available
   and affordable where they live.
2. Each day's meals must sum to within ±5% of the kcal target and within ±10g
   of the protein target.
3. Repeat breakfast structures — real people eat similar breakfasts. Vary
   lunches/dinners across the week so no main dish appears more than 3 times.
4. Every meal: concrete item quantities ("150g grilled chicken", "1 cup rice").
5. Meal names follow the day rhythm: ${req.mealsPerDay >= 4 ? 'Breakfast, Lunch, Snack, Dinner' : 'Breakfast, Lunch, Dinner'}.
6. "title" is an appetizing short dish name.

Return ONLY valid JSON:
{
  "days": [
    { "dayNumber": 1,
      "meals": [
        { "name": "Breakfast", "title": "Dish Name",
          "items": ["quantity + food", "quantity + food"],
          "kcal": 520, "protein": 35, "carbs": 55, "fat": 16 }
      ]
    }
  ]
}
All 7 days, ${req.mealsPerDay} meals each.`;

  const parsed = await generateJSON<{ days: unknown[] }>({
    system: prompt,
    user: 'Build my meal plan',
    maxTokens: 16384,
    validate: p => Array.isArray(p?.days) && p.days.length === 7 &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p.days.every((d: any) => Array.isArray(d?.meals) && d.meals.length === req.mealsPerDay),
  });
  return sanitizeMealPlan(parsed, req.weekNumber);
}
