import { NextRequest, NextResponse } from 'next/server';
import { generateFoodCatalog } from '@/services/nutritionist';

export async function POST(request: NextRequest) {
  try {
    const { countryName } = await request.json();
    if (!countryName) return NextResponse.json({ error: 'countryName required' }, { status: 400 });
    const foods = await generateFoodCatalog(countryName);
    return NextResponse.json({ foods });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error generating food catalog';
    console.error('Food catalog API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
