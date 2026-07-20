/**
 * GhostFit — Quests data layer (goals & tasks)
 * Mirrors the user's Notion Workshop taxonomy: North Star → Quarterly → Monthly,
 * tasks with P1-P3 priority + do-date. Same Soul Coin economy as workouts.
 */
import { supabase } from './supabase';
import { grantCoins } from './db';
import { Quest, QuestTask, QuestType, QUEST_TYPE_META, TASK_PRIORITY_META } from './types';

async function uid(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTask(r: any): QuestTask {
  return {
    id: r.id,
    questId: r.quest_id,
    title: r.title,
    note: r.note,
    priority: r.priority ?? 2,
    doDate: r.do_date,
    isDone: r.is_done ?? false,
    doneAt: r.done_at ? new Date(r.done_at).getTime() : null,
    sortOrder: r.sort_order ?? 0,
  };
}

export async function getQuests(): Promise<{ quests: Quest[]; inbox: QuestTask[] }> {
  const userId = await uid();
  if (!userId) return { quests: [], inbox: [] };

  const [{ data: questRows }, { data: taskRows }] = await Promise.all([
    supabase.from('quests').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('quest_tasks').select('*').eq('user_id', userId)
      .order('is_done', { ascending: true })
      .order('priority', { ascending: true })
      .order('sort_order', { ascending: true }),
  ]);

  const tasks = (taskRows ?? []).map(rowToTask);
  const quests: Quest[] = (questRows ?? []).map(q => ({
    id: q.id,
    parentId: q.parent_id,
    title: q.title,
    why: q.why ?? '',
    questType: q.quest_type,
    status: q.status,
    targetDate: q.target_date,
    createdAt: new Date(q.created_at).getTime(),
    completedAt: q.completed_at ? new Date(q.completed_at).getTime() : null,
    tasks: tasks.filter(t => t.questId === q.id),
  }));
  return { quests, inbox: tasks.filter(t => t.questId === null) };
}

export async function createQuest(opts: {
  title: string;
  why: string;
  questType: QuestType;
  targetDate: string | null;
  parentId: string | null;
  tasks: Array<{ title: string; priority: number; doDate: string | null; note?: string }>;
}): Promise<string | null> {
  const userId = await uid();
  if (!userId) return null;

  const { data, error } = await supabase.from('quests').insert({
    user_id: userId,
    parent_id: opts.parentId,
    title: opts.title,
    why: opts.why,
    quest_type: opts.questType,
    target_date: opts.targetDate,
  }).select('id').single();

  if (error || !data) return null;

  if (opts.tasks.length > 0) {
    await supabase.from('quest_tasks').insert(opts.tasks.map((t, i) => ({
      user_id: userId,
      quest_id: data.id,
      title: t.title,
      note: t.note ?? null,
      priority: t.priority,
      do_date: t.doDate,
      sort_order: i,
    })));
  }
  return data.id;
}

export async function addTask(opts: {
  questId: string | null;
  title: string;
  priority?: number;
  doDate?: string | null;
}): Promise<QuestTask | null> {
  const userId = await uid();
  if (!userId) return null;

  const { data, error } = await supabase.from('quest_tasks').insert({
    user_id: userId,
    quest_id: opts.questId,
    title: opts.title,
    priority: opts.priority ?? 2,
    do_date: opts.doDate ?? null,
  }).select('*').single();

  if (error || !data) return null;
  return rowToTask(data);
}

/** Toggle done state. Awards priority-based coins on completion, claws back on undo. */
export async function toggleTask(task: QuestTask): Promise<number> {
  const nowDone = !task.isDone;
  const { error } = await supabase.from('quest_tasks').update({
    is_done: nowDone,
    done_at: nowDone ? new Date().toISOString() : null,
  }).eq('id', task.id);
  if (error) return 0;

  const reward = TASK_PRIORITY_META[task.priority]?.reward ?? 5;
  const delta = nowDone ? reward : -reward;
  await grantCoins(delta);
  return delta;
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const { error } = await supabase.from('quest_tasks').delete().eq('id', taskId);
  return !error;
}

/** Complete or kill a quest. Completion pays the quest-type reward. */
export async function closeQuest(quest: Quest, outcome: 'done' | 'killed'): Promise<number> {
  const { error } = await supabase.from('quests').update({
    status: outcome,
    completed_at: outcome === 'done' ? new Date().toISOString() : null,
  }).eq('id', quest.id);
  if (error) return 0;

  if (outcome === 'done') {
    const reward = QUEST_TYPE_META[quest.questType].reward;
    await grantCoins(reward);
    return reward;
  }
  return 0;
}

export async function reopenQuest(questId: string): Promise<boolean> {
  const { error } = await supabase.from('quests').update({
    status: 'active', completed_at: null,
  }).eq('id', questId);
  return !error;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Open tasks due today or overdue, P1 first. */
export function selectTodayTasks(quests: Quest[], inbox: QuestTask[]): QuestTask[] {
  const today = todayKey();
  const all = [...quests.filter(q => q.status === 'active').flatMap(q => q.tasks), ...inbox];
  return all
    .filter(t => !t.isDone && t.doDate !== null && t.doDate <= today)
    .sort((a, b) => a.priority - b.priority || (a.doDate ?? '').localeCompare(b.doDate ?? ''));
}

export function questProgress(quest: Quest): { done: number; total: number; pct: number } {
  const total = quest.tasks.length;
  const done = quest.tasks.filter(t => t.isDone).length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}
