import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/services/llm';

export async function POST(request: NextRequest) {
  try {
    const { imageBase64 } = await request.json();
    if (!imageBase64) return NextResponse.json({ error: 'imageBase64 required' }, { status: 400 });

    const result = await generateJSON<{ equipment: string[] }>({
      system: 'Identify all gym equipment in this image. Return ONLY JSON: { "equipment": string[] }. Example: { "equipment": ["Dumbbells", "Pull-up Bar", "Bench"] }. If none found: { "equipment": [] }',
      user: 'What gym equipment is in this photo?',
      image: { base64: imageBase64, mimeType: 'image/jpeg' },
      maxTokens: 1024,
      validate: p => Array.isArray(p?.equipment) && p.equipment.every((e: unknown) => typeof e === 'string'),
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
