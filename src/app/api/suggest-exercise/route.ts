import { NextResponse } from 'next/server';
import { generateJSON } from '@/services/llm';

export async function POST(req: Request) {
  try {
    const { prompt, equipment, goal } = await req.json();

    const systemPrompt = `You are a gym expert. Suggest 3-5 specific exercises based on the user's request.
    Current available equipment: ${(equipment ?? []).join(', ')}.
    User Goal: ${goal}.

    If an exercise requires equipment the user DOES NOT have, flag it clearly.
    Return ONLY a JSON object with this format:
    {
      "suggestions": [
        {
          "name": "string",
          "type": "strength" | "cardio",
          "equipmentNeeded": "string",
          "isEquipmentOwned": boolean,
          "reason": "string (why this fits the request)"
        }
      ]
    }`;

    const result = await generateJSON<{ suggestions: unknown[] }>({
      system: systemPrompt,
      user: `Suggest exercises for: ${prompt}`,
      maxTokens: 2048,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validate: p => Array.isArray(p?.suggestions) && p.suggestions.length >= 1 && p.suggestions.every((s: any) => s?.name),
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 });
  }
}
