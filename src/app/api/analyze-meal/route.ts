import { NextRequest, NextResponse } from 'next/server';
import { analyzeMeal } from '@/services/nutritionist';

export async function POST(request: NextRequest) {
  try {
    const { description, mealName } = await request.json();
    if (!description || !description.trim()) {
      return NextResponse.json({ error: 'description required' }, { status: 400 });
    }
    const meal = await analyzeMeal(description, mealName || 'Meal');
    return NextResponse.json({ meal });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error analyzing meal';
    console.error('Analyze meal API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
