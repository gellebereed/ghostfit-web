import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type SignupPayload = {
  email?: string;
};

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function POST(request: Request) {
  let payload: SignupPayload;
  try {
    payload = (await request.json()) as SignupPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const email = normalizeEmail(payload.email ?? '');
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!isValidEmail) {
    return NextResponse.json({ ok: false, error: 'Please enter a valid email.' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: 'Supabase is not configured.' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase
    .from('landing_signups')
    .insert({ email, source: 'landing_page' });

  if (error) {
    // 23505 = unique_violation in Postgres.
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, message: 'You are already on the list.' });
    }
    return NextResponse.json({ ok: false, error: 'Could not save your signup right now.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: 'You are in. We will notify you soon.' });
}
