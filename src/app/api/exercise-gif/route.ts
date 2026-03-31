import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'RapidAPI key not configured' }, { status: 500 });
  }

  const name = request.nextUrl.searchParams.get('name');
  if (!name) {
    return NextResponse.json({ error: 'Missing exercise name' }, { status: 400 });
  }

  try {
    const encoded = encodeURIComponent(name.toLowerCase().replace(/[^a-z\s]/g, ''));
    const res = await fetch(
      `https://exercisedb.p.rapidapi.com/exercises/name/${encoded}?limit=1`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'ExerciseDB fetch failed' }, { status: 502 });
    }

    const data = await res.json();
    if (!data || data.length === 0) {
      return NextResponse.json({ gifUrl: null, instructions: [], bodyPart: '' });
    }

    const exercise = data[0];
    return NextResponse.json({
      gifUrl: exercise.gifUrl ?? null,
      instructions: exercise.instructions ?? [],
      bodyPart: exercise.bodyPart ?? '',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
