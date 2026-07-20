/**
 * GhostFit — AI Nutritionist (server-side)
 *
 * Voice note: the nutritionist is the SUPPORTIVE coach persona — the ghost
 * taunts, the nutritionist never does. Keep generated copy encouraging.
 */
import { FoodItem, MealPlan } from '@/lib/types';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function callOpenAI(prompt: string, userMsg: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userMsg },
      ],
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '{}';
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

  const content = await callOpenAI(prompt, `Build the ${countryName} food catalog`, 8000);
  const parsed = JSON.parse(content);
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

  const content = await callOpenAI(prompt, `Food: ${name}${serving ? ` — serving: ${serving}` : ''}`, 400);
  const parsed = JSON.parse(content);
  if (parsed.error) return null;
  const food = sanitizeFood(parsed);
  if (food) food.isCustom = true;
  return food;
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

  const content = await callOpenAI(prompt, 'Build my meal plan', 8000);
  const parsed = JSON.parse(content);
  return sanitizeMealPlan(parsed, req.weekNumber);
}
