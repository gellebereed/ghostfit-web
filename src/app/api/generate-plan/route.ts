import { NextRequest, NextResponse } from 'next/server';
import { buildProgram } from '@/lib/program-engine';
import type { TrainingPhase } from '@/lib/types';

const PHASES: TrainingPhase[] = ['foundation', 'accumulation', 'intensification', 'deload', 'reentry'];

/**
 * Plan generation. The program engine is deterministic and dependency-free, so
 * this route never calls a model and cannot return a malformed week. Clients
 * can also call `buildProgram` directly; this endpoint exists for callers that
 * are not in the browser bundle.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;

    const equipment = Array.isArray(body.equipment)
      ? body.equipment.filter((item): item is string => typeof item === 'string').slice(0, 30)
      : [];
    const goal = typeof body.goal === 'string' && body.goal.trim() ? body.goal.trim().slice(0, 40) : 'fitness';
    const experience = typeof body.experience === 'string' ? body.experience.slice(0, 24) : 'beginner';
    const trainingDays = typeof body.trainingDays === 'number' ? body.trainingDays : 3;
    const sessionMinutes = typeof body.sessionMinutes === 'number' ? body.sessionMinutes : 45;
    const programWeek = typeof body.programWeek === 'number' ? body.programWeek : 1;
    const phase = typeof body.phase === 'string' && PHASES.includes(body.phase as TrainingPhase)
      ? body.phase as TrainingPhase
      : undefined;
    // The client knows its own weekday; the server's timezone is not the user's.
    const startDayIndex = typeof body.startDayIndex === 'number' && body.startDayIndex >= 0 && body.startDayIndex <= 6
      ? Math.floor(body.startDayIndex)
      : undefined;

    const plan = buildProgram({
      equipment: equipment.length ? equipment : ['Bodyweight Only'],
      goal,
      experience,
      trainingDays,
      sessionMinutes,
      programWeek,
      phase,
      startDayIndex,
    });

    return NextResponse.json(plan);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error generating plan';
    console.error('Plan generation API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
