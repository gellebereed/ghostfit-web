import { NextRequest, NextResponse } from 'next/server';
import { estimateFood } from '@/services/nutritionist';

export async function POST(request: NextRequest) {
  try {
    const { name, serving } = await request.json();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const food = await estimateFood(name, serving);
    if (!food) return NextResponse.json({ error: 'Could not recognize that as a food' }, { status: 422 });
    return NextResponse.json({ food });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error estimating food';
    console.error('Estimate food API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
