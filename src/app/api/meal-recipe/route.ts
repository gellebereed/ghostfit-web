import { NextRequest, NextResponse } from 'next/server';
import { generateRecipe } from '@/services/nutritionist';

export async function POST(request: NextRequest) {
  try {
    const { title, items, countryName } = await request.json();
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
    const recipe = await generateRecipe(title, items ?? [], countryName);
    return NextResponse.json({ recipe });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error generating recipe';
    console.error('Recipe API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
