import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const exercise = req.nextUrl.searchParams.get('exercise');
  if (!exercise) {
    return NextResponse.json({ videoId: null }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || apiKey === 'your_youtube_api_key_here') {
    return NextResponse.json({ videoId: null, error: 'YOUTUBE_API_KEY not configured' });
  }

  try {
    const query = encodeURIComponent(`how to do ${exercise} exercise tutorial proper form`);
    const url =
      `https://www.googleapis.com/youtube/v3/search` +
      `?part=snippet&q=${query}&type=video&maxResults=1&videoCategoryId=17&key=${apiKey}`;

    const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h on server
    if (!res.ok) {
      const err = await res.text();
      console.error('[youtube-search] API error:', err);
      return NextResponse.json({ videoId: null });
    }

    const data = await res.json();
    const videoId: string | null = data?.items?.[0]?.id?.videoId ?? null;
    return NextResponse.json({ videoId });
  } catch (err) {
    console.error('[youtube-search] Fetch failed:', err);
    return NextResponse.json({ videoId: null });
  }
}
