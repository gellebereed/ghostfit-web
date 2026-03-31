/**
 * GhostFit — Data Layer (Supabase)
 *
 * All exported function signatures are unchanged from the IndexedDB version.
 * Internal implementation now uses Supabase instead of IndexedDB.
 * Callers (pages) require zero changes.
 */
import { supabase } from './supabase';
import { WorkoutPlan, GhostSession, UserProfile, ExerciseInfo } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

let cachedUserId: string | null = null;
async function uid(): Promise<string | null> {
  if (cachedUserId) return cachedUserId;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) {
    cachedUserId = session.user.id;
    return cachedUserId;
  }
  return null;
}

// localStorage cache key for instant first-render
const PROFILE_CACHE_KEY = 'ghostfit_profile';

// Strict in-memory cache for SPA instant fluid navigation
const memoryCache: {
  profile?: UserProfile | null;
  plan?: WorkoutPlan | null;
  sessions?: GhostSession[] | null;
  winCount?: number;
  streak?: number;
  yesterdayResult?: 'win' | 'loss' | 'none';
} = {};

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<UserProfile | null> {
  if (memoryCache.profile !== undefined) return memoryCache.profile;

  // Fast path: return cached value immediately while Supabase loads
  const cached = localStorage.getItem(PROFILE_CACHE_KEY);
  const userId = await uid();
  if (!userId) return cached ? JSON.parse(cached) : null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return cached ? JSON.parse(cached) : null;

  // Map snake_case DB columns → camelCase UserProfile
  const profile: UserProfile = {
    equipment: data.equipment ?? [],
    goal: data.goal ?? '',
    currentWeek: data.current_week ?? 1,
    onboardingComplete: data.onboarding_complete ?? false,
    createdAt: new Date(data.created_at).getTime(),
    soulCoins: data.soul_coins ?? 0,
    unlockedCosmetics: data.unlocked_cosmetics ?? [],
    equippedCosmetics: data.equipped_cosmetics ?? {},
  };
  localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  memoryCache.profile = profile;
  return profile;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const userId = await uid();
  if (!userId) return;

  await supabase.from('profiles').upsert({
    id: userId,
    equipment: profile.equipment,
    goal: profile.goal,
    current_week: profile.currentWeek,
    onboarding_complete: profile.onboardingComplete,
  });
  localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  memoryCache.profile = profile;
}

// ─── Workout Plans ────────────────────────────────────────────────────────────

export async function savePlan(plan: WorkoutPlan): Promise<void> {
  const userId = await uid();
  if (!userId) return;

  // Deactivate existing active plans
  await supabase
    .from('workout_plans')
    .update({ is_active: false })
    .eq('user_id', userId);

  await supabase.from('workout_plans').insert({
    user_id: userId,
    week_number: plan.weekNumber,
    days: plan.days,
    is_active: true,
    created_at: new Date(plan.createdAt).toISOString(),
  });
  memoryCache.plan = plan;
}

export async function getCurrentPlan(): Promise<WorkoutPlan | null> {
  if (memoryCache.plan !== undefined) return memoryCache.plan;

  const CACHE_KEY = 'ghostfit_active_plan';
  const cached = localStorage.getItem(CACHE_KEY);
  
  const userId = await uid();
  if (!userId) return cached ? JSON.parse(cached) : null;

  const { data, error } = await supabase
    .from('workout_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return cached ? JSON.parse(cached) : null;
  
  const plan = {
    weekNumber: data.week_number,
    days: data.days,
    createdAt: new Date(data.created_at).getTime(),
  };
  
  localStorage.setItem(CACHE_KEY, JSON.stringify(plan));
  memoryCache.plan = plan;
  return plan;
}

// ─── Ghost Sessions ───────────────────────────────────────────────────────────

export async function saveGhostSession(session: GhostSession): Promise<void> {
  const userId = await uid();
  if (!userId) return;

  await supabase.from('ghost_sessions').insert({
    id: session.id,
    user_id: userId,
    exercise_name: session.exerciseName,
    date: new Date(session.date).toISOString(),
    total_reps: session.totalReps,
    avg_weight: session.avgWeight,
    total_duration: session.totalDuration,
    sets_completed: session.setsCompleted,
    result: session.result,
    character_tier: session.characterTier,
  });
  
  // Invalidate session-dependent caches
  const cacheKeys = [
    'ghostfit_win_count', 
    'ghostfit_streak', 
    'ghostfit_yesterday_result', 
    'ghostfit_active_plan' // In case it's a new plan cycle
  ];
  cacheKeys.forEach(k => localStorage.removeItem(k));
  
  memoryCache.sessions = null;
  memoryCache.winCount = undefined;
  memoryCache.streak = undefined;
  memoryCache.yesterdayResult = undefined;
}

export async function getAllSessions(): Promise<GhostSession[]> {
  if (memoryCache.sessions !== undefined && memoryCache.sessions !== null) return memoryCache.sessions;

  const userId = await uid();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('ghost_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error || !data) return [];
  const sessions = data.map(rowToSession);
  memoryCache.sessions = sessions;
  return sessions;
}

export async function getGhostForExercise(exerciseName: string): Promise<GhostSession | null> {
  const userId = await uid();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('ghost_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('exercise_name', exerciseName)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return rowToSession(data);
}

export async function getWinCount(): Promise<number> {
  if (memoryCache.winCount !== undefined) return memoryCache.winCount;
  
  const CACHE_KEY = 'ghostfit_win_count';
  const cached = localStorage.getItem(CACHE_KEY);

  const userId = await uid();
  if (!userId) return cached ? parseInt(cached) : 0;

  const { count, error } = await supabase
    .from('ghost_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('result', 'win');

  const wc = error ? (cached ? parseInt(cached) : 0) : (count ?? 0);
  
  localStorage.setItem(CACHE_KEY, wc.toString());
  memoryCache.winCount = wc;
  return wc;
}

export async function getStreak(): Promise<number> {
  if (memoryCache.streak !== undefined) return memoryCache.streak;

  const CACHE_KEY = 'ghostfit_streak';
  const cached = localStorage.getItem(CACHE_KEY);

  const sessions = await getAllSessions();
  if (sessions.length === 0 && cached) return parseInt(cached);

  let streak = 0;
  const byDate = new Map<string, GhostSession[]>();
  sessions.forEach(s => {
    const d = new Date(s.date).toDateString();
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(s);
  });
  const dates = Array.from(byDate.keys()).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );
  for (const d of dates) {
    if (byDate.get(d)!.some(s => s.result === 'win')) streak++;
    else break;
  }
  
  localStorage.setItem(CACHE_KEY, streak.toString());
  memoryCache.streak = streak;
  return streak;
}

export async function getYesterdayResult(): Promise<'win' | 'loss' | 'none'> {
  if (memoryCache.yesterdayResult !== undefined) return memoryCache.yesterdayResult;

  const CACHE_KEY = 'ghostfit_yesterday_result';
  const cached = localStorage.getItem(CACHE_KEY) as 'win' | 'loss' | 'none';

  const userId = await uid();
  if (!userId) return cached || 'none';

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yd = yesterday.toDateString();

  const { data } = await supabase
    .from('ghost_sessions')
    .select('result')
    .eq('user_id', userId)
    .gte('date', new Date(yd).toISOString())
    .lt('date', new Date().toDateString() === yd ? new Date().toISOString() : new Date(yd + ' 23:59:59').toISOString());

  if (!data || data.length === 0) {
    const res = cached || 'none';
    memoryCache.yesterdayResult = res;
    return res;
  }

  const wins = data.filter(s => s.result === 'win').length;
  const losses = data.filter(s => s.result !== 'win').length;
  const res = wins >= losses ? 'win' : 'loss';
  
  localStorage.setItem(CACHE_KEY, res);
  memoryCache.yesterdayResult = res;
  return res;
}

export async function getAllTimeBest(exerciseName: string): Promise<{ totalReps: number; totalDuration: number }> {
  const userId = await uid();
  if (!userId) return { totalReps: 0, totalDuration: 0 };

  const { data } = await supabase
    .from('ghost_sessions')
    .select('total_reps, total_duration')
    .eq('user_id', userId)
    .eq('exercise_name', exerciseName);

  if (!data || data.length === 0) return { totalReps: 0, totalDuration: 0 };
  return {
    totalReps: Math.max(...data.map(s => s.total_reps ?? 0)),
    totalDuration: Math.max(...data.map(s => s.total_duration ?? 0)),
  };
}

// ─── Exercise Cache ───────────────────────────────────────────────────────────

export async function getCachedExercise(name: string): Promise<ExerciseInfo | null> {
  const { data, error } = await supabase
    .from('exercise_cache')
    .select('*')
    .eq('exercise_name', name)
    .single();

  if (error || !data) return null;
  return {
    name: data.exercise_name,
    gifUrl: data.gif_url ?? '',
    instructions: (data.instructions as string[]) ?? [],
    bodyPart: data.body_part ?? '',
    youtubeVideoId: data.youtube_video_id ?? undefined,
  };
}

export async function cacheExercise(info: ExerciseInfo): Promise<void> {
  await supabase.from('exercise_cache').upsert({
    exercise_name: info.name,
    gif_url: info.gifUrl,
    instructions: info.instructions,
    body_part: info.bodyPart,
    youtube_video_id: info.youtubeVideoId ?? null,
    cached_at: new Date().toISOString(),
  });
}

export async function updateCachedVideoId(name: string, videoId: string): Promise<void> {
  // Try update first; insert if not exists
  const { error } = await supabase
    .from('exercise_cache')
    .update({ youtube_video_id: videoId, cached_at: new Date().toISOString() })
    .eq('exercise_name', name);

  if (error) {
    // Row may not exist yet — upsert
    await supabase.from('exercise_cache').upsert({
      exercise_name: name,
      youtube_video_id: videoId,
      cached_at: new Date().toISOString(),
    });
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSession(row: any): GhostSession {
  return {
    id: row.id,
    exerciseName: row.exercise_name,
    date: new Date(row.date).getTime(),
    totalReps: row.total_reps ?? 0,
    avgWeight: row.avg_weight ?? 0,
    totalDuration: row.total_duration ?? 0,
    setsCompleted: row.sets_completed ?? 0,
    result: row.result,
    characterTier: row.character_tier ?? 1,
  };
}

// ─── RPG Economy ─────────────────────────────────────────────────────────────

export async function awardSoulCoins(
  result: 'win' | 'loss' | 'incomplete',
  marginPercent: number
): Promise<number> {
  const userId = await uid();
  if (!userId) return 0;

  let coins = 0;
  if (result === 'win') {
    coins = 10;
    if (marginPercent >= 20) coins += 5;
    if (marginPercent >= 50) coins += 10;
  } else if (result === 'loss') {
    coins = 2;
  } else {
    coins = 1;
  }

  await supabase.rpc('add_soul_coins', { user_id: userId, amount: coins });

  if (memoryCache.profile) {
    memoryCache.profile.soulCoins = (memoryCache.profile.soulCoins || 0) + coins;
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(memoryCache.profile));
  }

  return coins;
}
