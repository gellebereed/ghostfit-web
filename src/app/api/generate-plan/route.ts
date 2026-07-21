import { NextRequest, NextResponse } from 'next/server';
import { generateWorkoutPlan } from '@/services/openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      equipment?: unknown;
      goal?: unknown;
      experience?: unknown;
      trainingDays?: unknown;
      sessionMinutes?: unknown;
    };
    const equipment = Array.isArray(body.equipment)
      ? body.equipment.filter((item): item is string => typeof item === 'string').slice(0, 30)
      : [];
    const goal = typeof body.goal === 'string' && body.goal.trim() ? body.goal.trim().slice(0, 40) : 'fitness';
    const experience = typeof body.experience === 'string' ? body.experience.slice(0, 24) : 'beginner';
    const trainingDays = typeof body.trainingDays === 'number' ? body.trainingDays : 3;
    const sessionMinutes = typeof body.sessionMinutes === 'number' ? body.sessionMinutes : 45;
    const plan = await generateWorkoutPlan(
      equipment.length ? equipment : ['Bodyweight Only'],
      goal,
      1,
      { experience, trainingDays, sessionMinutes },
    );
    return NextResponse.json(plan);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error generating plan';
    console.error('Plan generation API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
