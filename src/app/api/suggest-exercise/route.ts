import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt, equipment, goal } = await req.json();

    const systemPrompt = `You are a gym expert. Suggest 3-5 specific exercises based on the user's request.
    Current available equipment: ${equipment.join(', ')}.
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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Suggest exercises for: ${prompt}` }
        ],
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    return NextResponse.json(JSON.parse(content || '{}'));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
