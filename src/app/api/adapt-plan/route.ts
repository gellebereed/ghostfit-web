import { NextRequest, NextResponse } from 'next/server';
import { adaptWorkoutPlan } from '@/services/openai';

export async function POST(request: NextRequest) {
  try {
    const { equipment, goal, lastPlan, performance } = await request.json();
    const plan = await adaptWorkoutPlan(equipment, goal, lastPlan, performance);
    return NextResponse.json(plan);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error adapting plan';
    console.error('Plan adaptation API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
