import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY') {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }
  try {
    const { equipment, goal } = await request.json();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are an expert fitness coach. Create a 7-day workout plan.
Equipment available: ${JSON.stringify(equipment)}
User goal: ${goal}
Rules:
- Only use exercises possible with available equipment or bodyweight
- Day 7 is always rest
- 4-6 exercises per workout day
- Include sets and reps
- Keep exercise names standard and simple
- For cardio exercises, add durationSeconds (e.g. 300 for 5 min)

Return ONLY valid JSON:
{
  "weekNumber": 1,
  "days": [
    {
      "dayNumber": 1,
      "dayName": "Monday",
      "focus": "Upper Body",
      "isRest": false,
      "exercises": [
        { "name": "Dumbbell Bicep Curl", "sets": 3, "reps": 12, "equipment": "Dumbbells", "type": "strength" }
      ]
    }
  ]
}
Exercise type is either "strength" or "cardio".` },
          { role: 'user', content: 'Generate my workout plan' }
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
