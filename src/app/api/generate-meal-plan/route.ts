import { NextRequest, NextResponse } from 'next/server';
import { generateMealPlan, MealPlanRequest } from '@/services/nutritionist';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MealPlanRequest;
    if (!body.countryName || !body.targetKcal || !body.likedFoods?.length) {
      return NextResponse.json({ error: 'countryName, targetKcal and likedFoods required' }, { status: 400 });
    }
    const plan = await generateMealPlan(body);
    if (!plan.days.length) throw new Error('Empty plan generated');
    return NextResponse.json(plan);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error generating meal plan';
    console.error('Meal plan API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
