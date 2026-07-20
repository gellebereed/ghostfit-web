// AI quest coach — decomposes a goal into concrete first tasks.
// Implementation-intention style: every task is a specific, finishable action.
import { generateJSON } from './llm';

export interface SuggestedTask {
  title: string;
  priority: number;      // 1-3
  dueOffsetDays: number; // days from today
}

export async function breakdownQuest(opts: {
  title: string;
  why: string;
  questType: string;
  targetDate?: string | null;
}): Promise<SuggestedTask[]> {
  const prompt = `You are a ruthless-but-kind productivity coach. The user set a goal;
break it into the first concrete tasks that create momentum.

GOAL: ${opts.title}
WHY IT MATTERS: ${opts.why || 'not stated'}
HORIZON: ${opts.questType}${opts.targetDate ? ` (target: ${opts.targetDate})` : ''}

Rules:
- 5-8 tasks, each a single finishable action with a clear done-condition
  ("Draft X and send to Y", not "work on X")
- Start with a task doable TODAY in under 30 minutes (momentum first)
- priority: 1 = critical path, 2 = important, 3 = nice to have
- dueOffsetDays: 0 = today, spread realistically across the horizon
- No filler tasks, no "research options" unless genuinely the first step

Return ONLY valid JSON:
{ "tasks": [ { "title": "...", "priority": 1, "dueOffsetDays": 0 } ] }`;

  const parsed = await generateJSON<{ tasks: unknown[] }>({
    system: prompt,
    user: 'Break down my goal',
    maxTokens: 2048,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validate: p => Array.isArray(p?.tasks) && p.tasks.length >= 3 && p.tasks.every((t: any) => t?.title),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (parsed.tasks ?? []).slice(0, 8).map((t: any) => ({
    title: String(t.title ?? '').slice(0, 200),
    priority: [1, 2, 3].includes(Number(t.priority)) ? Number(t.priority) : 2,
    dueOffsetDays: Math.max(0, Math.min(90, Number(t.dueOffsetDays) || 0)),
  })).filter((t: SuggestedTask) => t.title.length > 0);
}
