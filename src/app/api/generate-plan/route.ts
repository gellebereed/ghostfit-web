import { NextRequest, NextResponse } from 'next/server';
import { generateWorkoutPlan } from '@/services/openai';

export async function POST(request: NextRequest) {
  try {
    const { equipment, goal } = await request.json();
    const plan = await generateWorkoutPlan(equipment, goal);
    return NextResponse.json(plan);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error generating plan';
    console.error('Plan generation API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
