import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY') {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }
  try {
    const { equipment, goal, lastPlan, performance } = await request.json();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are a fitness coach reviewing client performance.
Equipment: ${JSON.stringify(equipment)}
Goal: ${goal}
Last week plan: ${JSON.stringify(lastPlan)}
Performance: ${JSON.stringify(performance)}

Generate updated Week ${(lastPlan?.weekNumber || 0) + 1} plan.
Adapt difficulty:
- Completed 80%+ with wins: increase reps or weight by 10%
- Completed 60-79%: keep same difficulty
- Below 60%: reduce slightly
Return same JSON format.` },
          { role: 'user', content: 'Generate adapted plan' }
        ],
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      }),
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    return NextResponse.json(JSON.parse(content));
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
