/**
 * GhostFit — Daily Rhythm (habits: deen & body daily practices)
 * Small, repeated daily wins with streaks — the engine of identity change.
 */
import { supabase } from './supabase';
import { grantCoins } from './db';

export type HabitCategory = 'deen' | 'body' | 'mind';

export interface Habit {
  id: string;
  title: string;
  emoji: string;
  category: HabitCategory;
  sortOrder: number;
  doneToday: boolean;
  streak: number;
}

export const HABIT_COIN = 2;
export const ALL_DONE_BONUS = 15;

/** The user's real Deen & Body daily rhythm, offered as a one-tap starter pack. */
export const PRESET_HABITS: Array<{ title: string; emoji: string; category: HabitCategory }> = [
  { title: 'Fajr on time',                emoji: '🕌', category: 'deen' },
  { title: 'Stay at mosque till Ishraq',  emoji: '🌅', category: 'deen' },
  { title: 'Surah Al-Baqarah',            emoji: '📖', category: 'deen' },
  { title: '1 juz / hizb of Qur\'an',     emoji: '🕋', category: 'deen' },
  { title: 'Sabah & Masa adhkar',         emoji: '📿', category: 'deen' },
  { title: '10 min Salawat & dhikr',      emoji: '🤲', category: 'deen' },
  { title: '1 hour walk',                 emoji: '🚶', category: 'body' },
];

async function uid(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getHabits(): Promise<Habit[]> {
  const userId = await uid();
  if (!userId) return [];

  const since = new Date(Date.now() - 60 * 86400000);
  const [{ data: habitRows }, { data: logRows }] = await Promise.all([
    supabase.from('habits').select('*').eq('user_id', userId).eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase.from('habit_logs').select('habit_id, log_date').eq('user_id', userId)
      .gte('log_date', dateKey(since)),
  ]);

  const today = dateKey(new Date());
  const logsByHabit = new Map<string, Set<string>>();
  (logRows ?? []).forEach(l => {
    if (!logsByHabit.has(l.habit_id)) logsByHabit.set(l.habit_id, new Set());
    logsByHabit.get(l.habit_id)!.add(l.log_date);
  });

  return (habitRows ?? []).map(h => {
    const dates = logsByHabit.get(h.id) ?? new Set();
    // Streak: consecutive days ending today (or yesterday if today not yet done)
    let streak = 0;
    const cursor = new Date();
    if (!dates.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (dates.has(dateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return {
      id: h.id,
      title: h.title,
      emoji: h.emoji ?? '✨',
      category: h.category,
      sortOrder: h.sort_order ?? 0,
      doneToday: dates.has(today),
      streak,
    };
  });
}

/** Toggle today's log. Returns coin delta (includes all-done bonus when earned). */
export async function toggleHabit(habit: Habit, allOthersDone: boolean): Promise<number> {
  const userId = await uid();
  if (!userId) return 0;
  const today = dateKey(new Date());

  if (habit.doneToday) {
    const { error } = await supabase.from('habit_logs').delete()
      .eq('habit_id', habit.id).eq('log_date', today);
    if (error) return 0;
    await grantCoins(-HABIT_COIN);
    return -HABIT_COIN;
  }

  const { error } = await supabase.from('habit_logs').insert({
    user_id: userId, habit_id: habit.id, log_date: today,
  });
  if (error) return 0;
  const delta = HABIT_COIN + (allOthersDone ? ALL_DONE_BONUS : 0);
  await grantCoins(delta);
  return delta;
}

export async function addHabits(items: Array<{ title: string; emoji: string; category: HabitCategory }>): Promise<boolean> {
  const userId = await uid();
  if (!userId) return false;
  const { error } = await supabase.from('habits').insert(
    items.map((h, i) => ({ user_id: userId, title: h.title, emoji: h.emoji, category: h.category, sort_order: i }))
  );
  return !error;
}

export async function removeHabit(habitId: string): Promise<boolean> {
  const { error } = await supabase.from('habits').update({ is_active: false }).eq('id', habitId);
  return !error;
}
