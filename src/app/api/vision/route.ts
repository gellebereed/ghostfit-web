import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_OPENAI_API_KEY') {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }
  try {
    const { imageBase64 } = await request.json();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Identify all gym equipment in this image. Return ONLY JSON: { "equipment": string[] }. Example: { "equipment": ["Dumbbells", "Pull-up Bar", "Bench"] }. If none found: { "equipment": [] }' },
          { role: 'user', content: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' } }] }
        ],
        max_tokens: 300,
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
