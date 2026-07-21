import { NextRequest, NextResponse } from 'next/server';
import { generateGroceryList } from '@/services/nutritionist';

export async function POST(request: NextRequest) {
  try {
    const { mealItems, countryName } = await request.json();
    if (!Array.isArray(mealItems) || mealItems.length === 0) {
      return NextResponse.json({ error: 'mealItems required' }, { status: 400 });
    }
    const categories = await generateGroceryList(mealItems, countryName);
    return NextResponse.json({ categories });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error building grocery list';
    console.error('Grocery list API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
