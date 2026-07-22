import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iweznjyjzklpuhxmuyuu.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Browser-side Supabase client (use in Client Components)
export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey
);

// Helper: get current authenticated user ID (throws if not logged in)
export async function getCurrentUserId(): Promise<string> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Not authenticated');
    return user.id;
  } catch (err) {
    console.warn('[Supabase Auth Check] User is not logged in or session expired:', err);
    throw err;
  }
}
