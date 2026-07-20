import { NextRequest, NextResponse } from 'next/server';
import { breakdownQuest } from '@/services/questCoach';

export async function POST(request: NextRequest) {
  try {
    const { title, why, questType, targetDate } = await request.json();
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
    const tasks = await breakdownQuest({ title, why, questType, targetDate });
    return NextResponse.json({ tasks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error breaking down quest';
    console.error('Breakdown quest API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
