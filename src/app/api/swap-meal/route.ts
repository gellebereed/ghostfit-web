import { NextRequest, NextResponse } from 'next/server';
import { swapMealOption, SwapMealRequest } from '@/services/nutritionist';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SwapMealRequest;
    if (!body.mealName || !body.likedFoods?.length) {
      return NextResponse.json({ error: 'mealName and likedFoods required' }, { status: 400 });
    }
    const meal = await swapMealOption(body);
    return NextResponse.json({ meal });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error swapping meal';
    console.error('Swap meal API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
