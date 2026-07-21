'use client';
import BottomNav from '@/components/BottomNav';
import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import {
  Quest, QuestTask, QuestType, QUEST_TYPE_META, TASK_PRIORITY_META,
} from '@/lib/types';
import {
  addTask, closeQuest, createQuest, deleteTask, getQuests, questProgress,
  selectTodayTasks, toggleTask,
} from '@/lib/quests';
import {
  addHabits, getHabits, Habit, PRESET_HABITS, removeHabit, toggleHabit,
} from '@/lib/habits';
import { SuggestedTask } from '@/services/questCoach';

const TYPE_ORDER: QuestType[] = ['north_star', 'quarterly', 'monthly'];

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return '';
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (days < 0) return `${-days}d overdue`;
  if (days === 0) return 'due today';
  return `${days}d left`;
}

export default function QuestsPage() {
  const { profile, refreshProfile } = useAppStore();
  const [ready, setReady] = useState(false);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [inbox, setInbox] = useState<QuestTask[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [coinFlash, setCoinFlash] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<{ quest: Quest; coins: number } | null>(null);
  const [quickTask, setQuickTask] = useState('');
  const [newTaskTitles, setNewTaskTitles] = useState<Record<string, string>>({});

  // Daily Rhythm (deen & body habits)
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitEdit, setHabitEdit] = useState(false);
  const [newHabit, setNewHabit] = useState('');

  // New quest sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [qTitle, setQTitle] = useState('');
  const [qWhy, setQWhy] = useState('');
  const [qType, setQType] = useState<QuestType>('monthly');
  const [qTarget, setQTarget] = useState('');
  const [qParent, setQParent] = useState<string>('');
  const [suggested, setSuggested] = useState<SuggestedTask[] | null>(null);
  const [suggestedOn, setSuggestedOn] = useState<Set<number>>(new Set());
  const [breakingDown, setBreakingDown] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    await refreshProfile();
    const [{ quests: qs, inbox: ib }, hb] = await Promise.all([getQuests(), getHabits()]);
    setQuests(qs);
    setInbox(ib);
    setHabits(hb);
    setReady(true);
  }, [refreshProfile]);

  useEffect(() => { load(); }, [load]);

  function flashCoins(delta: number) {
    if (delta === 0) return;
    setCoinFlash(delta);
    setTimeout(() => setCoinFlash(null), 1600);
  }

  async function handleToggle(task: QuestTask) {
    const delta = await toggleTask(task);
    flashCoins(delta);
    await load();
  }

  async function handleToggleHabit(habit: Habit) {
    const othersDone = habits.filter(h => h.id !== habit.id).every(h => h.doneToday);
    const delta = await toggleHabit(habit, !habit.doneToday && othersDone);
    flashCoins(delta);
    setHabits(await getHabits());
  }

  async function handleAddPresets() {
    const existing = new Set(habits.map(h => h.title.toLowerCase()));
    const toAdd = PRESET_HABITS.filter(p => !existing.has(p.title.toLowerCase()));
    if (toAdd.length > 0) await addHabits(toAdd);
    setHabits(await getHabits());
  }

  async function handleAddHabit() {
    if (!newHabit.trim()) return;
    await addHabits([{ title: newHabit.trim(), emoji: '✨', category: 'body' }]);
    setNewHabit('');
    setHabits(await getHabits());
  }

  async function handleQuickAdd() {
    if (!quickTask.trim()) return;
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await addTask({ questId: null, title: quickTask.trim(), doDate: key });
    setQuickTask('');
    await load();
  }

  async function handleAddToQuest(questId: string) {
    const title = (newTaskTitles[questId] ?? '').trim();
    if (!title) return;
    await addTask({ questId, title });
    setNewTaskTitles(prev => ({ ...prev, [questId]: '' }));
    await load();
  }

  async function handleComplete(quest: Quest) {
    const coins = await closeQuest(quest, 'done');
    setCelebration({ quest, coins });
    await load();
  }

  async function handleKill(quest: Quest) {
    await closeQuest(quest, 'killed');
    await load();
  }

  async function handleBreakdown() {
    if (!qTitle.trim() || breakingDown) return;
    setBreakingDown(true);
    try {
      const res = await fetch('/api/breakdown-quest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: qTitle, why: qWhy, questType: qType, targetDate: qTarget || null }),
      });
      if (res.ok) {
        const { tasks } = await res.json();
        setSuggested(tasks);
        setSuggestedOn(new Set(tasks.map((_: SuggestedTask, i: number) => i)));
      }
    } finally {
      setBreakingDown(false);
    }
  }

  async function handleCreateQuest() {
    if (!qTitle.trim() || creating) return;
    setCreating(true);
    const chosen = (suggested ?? []).filter((_, i) => suggestedOn.has(i)).map(t => {
      const due = new Date(Date.now() + t.dueOffsetDays * 86400000);
      const dueKey = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
      return { title: t.title, priority: t.priority, doDate: dueKey };
    });
    await createQuest({
      title: qTitle.trim(),
      why: qWhy.trim(),
      questType: qType,
      targetDate: qTarget || null,
      parentId: qParent || null,
      tasks: chosen,
    });
    setCreating(false);
    setSheetOpen(false);
    setQTitle(''); setQWhy(''); setQTarget(''); setQParent(''); setSuggested(null);
    await load();
  }

  if (!ready) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div className="ghost-loader" style={{ fontSize: 40 }}>🎯</div>
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Loading your quests...</p>
      </div>
    );
  }

  const activeQuests = quests.filter(q => q.status === 'active');
  const closedQuests = quests.filter(q => q.status !== 'active').slice(-6).reverse();
  const todayTasks = selectTodayTasks(quests, inbox);
  const questTitle = (id: string | null) => quests.find(q => q.id === id)?.title ?? null;

  return (
    <>
      {celebration && (
        <div className="verdict-overlay" onClick={() => setCelebration(null)}>
          <div className="verdict-card win">
            <div className="verdict-emoji">{QUEST_TYPE_META[celebration.quest.questType].emoji}</div>
            <h2 className="verdict-title">QUEST COMPLETE</h2>
            <p className="verdict-sub">{celebration.quest.title}</p>
            {celebration.quest.why && (
              <p className="verdict-sub" style={{ fontStyle: 'italic' }}>&quot;{celebration.quest.why}&quot;<br/>— you said this mattered. You proved it.</p>
            )}
            <p className="verdict-coins">+{celebration.coins} Soul Coins 🪙</p>
            <button className="btn-primary" onClick={() => setCelebration(null)}>ONWARD</button>
          </div>
        </div>
      )}

      {coinFlash !== null && (
        <div className="coin-flash">{coinFlash > 0 ? `+${coinFlash}` : coinFlash} 🪙</div>
      )}

      <header className="hdr">
        <span className="hdr-logo">🎯 QUESTS</span>
        <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>🪙 {profile?.soulCoins ?? 0}</span>
      </header>

      <div className="arena-body">
        {/* DAILY RHYTHM — deen & body daily practices */}
        <div className="rhythm-card">
          <div className="arena-card-top">
            <span className="arena-metric" style={{ color: '#FFD700' }}>☪️ Daily Rhythm</span>
            <span className="arena-timer">
              {habits.length > 0 && `${habits.filter(h => h.doneToday).length}/${habits.length} today`}
              <button className="meal-undo" style={{ marginLeft: 8 }} onClick={() => setHabitEdit(e => !e)}>
                {habitEdit ? 'done' : 'edit'}
              </button>
            </span>
          </div>

          {habits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <p className="arena-card-sub" style={{ marginBottom: 12 }}>
                The practices that anchor your day — deen first, body second. Small daily wins, tracked with streaks.
              </p>
              <div className="rhythm-preset-list">
                {PRESET_HABITS.map(p => (
                  <span key={p.title} className="rhythm-preset">{p.emoji} {p.title}</span>
                ))}
              </div>
              <button className="btn-primary" style={{ marginTop: 14 }} onClick={handleAddPresets}>
                BEGIN MY RHYTHM ☪️
              </button>
            </div>
          ) : (
            <>
              {habits.map(h => (
                <div className="rhythm-row" key={h.id}>
                  <button
                    className={`rhythm-check ${h.doneToday ? 'checked' : ''}`}
                    onClick={() => handleToggleHabit(h)}
                  >{h.doneToday ? '✓' : h.emoji}</button>
                  <div className="task-body">
                    <span className={`task-title ${h.doneToday ? 'rhythm-done' : ''}`}>{h.title}</span>
                    {h.streak > 1 && <span className="task-meta" style={{ color: '#FFB020' }}>{h.streak} day streak 🔥</span>}
                  </div>
                  {habitEdit && (
                    <button className="task-delete" onClick={() => removeHabit(h.id).then(() => getHabits().then(setHabits))}>✕</button>
                  )}
                </div>
              ))}
              {habits.length > 0 && habits.every(h => h.doneToday) && (
                <p className="rhythm-alldone">🌟 Full rhythm today. This is who you are now.</p>
              )}
              {habitEdit && (
                <div className="arena-code-row">
                  <input
                    className="arena-input"
                    style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 600, fontSize: 14 }}
                    placeholder="Add a daily practice..."
                    value={newHabit}
                    onChange={e => setNewHabit(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddHabit()}
                  />
                  <button className="arena-btn accept" onClick={handleAddHabit}>+</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* TODAY */}
        <div className="arena-card">
          <div className="arena-card-top">
            <span className="arena-metric">Today</span>
            <span className="arena-timer">{todayTasks.length === 0 ? 'all clear' : `${todayTasks.length} due`}</span>
          </div>
          {todayTasks.length === 0 && (
            <p className="arena-card-sub" style={{ textAlign: 'center' }}>Nothing due. Add a task or start a quest below.</p>
          )}
          {todayTasks.map(t => (
            <div className="task-row" key={t.id}>
              <button className="task-check" onClick={() => handleToggle(t)} aria-label="complete task" />
              <div className="task-body">
                <span className="task-title">{t.title}</span>
                <span className="task-meta">
                  <span style={{ color: TASK_PRIORITY_META[t.priority].color }}>{TASK_PRIORITY_META[t.priority].label}</span>
                  {questTitle(t.questId) && <> · {questTitle(t.questId)}</>}
                  {t.doDate && <> · {daysUntil(t.doDate)}</>}
                </span>
              </div>
            </div>
          ))}
          <div className="arena-code-row" style={{ marginTop: 10 }}>
            <input
              className="arena-input"
              style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 600, fontSize: 14 }}
              placeholder="Quick task for today..."
              value={quickTask}
              onChange={e => setQuickTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
            />
            <button className="arena-btn accept" onClick={handleQuickAdd}>+ ADD</button>
          </div>
        </div>

        <button className="btn-primary" onClick={() => setSheetOpen(true)}>+ NEW QUEST</button>

        {/* QUESTS by horizon */}
        {TYPE_ORDER.map(type => {
          const group = activeQuests.filter(q => q.questType === type);
          if (group.length === 0) return null;
          return (
            <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 className="arena-section-title">{QUEST_TYPE_META[type].emoji} {QUEST_TYPE_META[type].label.toUpperCase()}S</h4>
              {group.map(q => {
                const prog = questProgress(q);
                const isOpen = expanded.has(q.id);
                const parent = quests.find(p => p.id === q.parentId);
                return (
                  <div className={`quest-card tier-${q.questType}`} key={q.id}>
                    <div className="quest-card-head" onClick={() => {
                      setExpanded(prev => {
                        const next = new Set(prev);
                        if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                        return next;
                      });
                    }}>
                      <div className="quest-card-info">
                        <p className="quest-card-title">{q.title}</p>
                        {parent && <p className="quest-card-parent">↳ {parent.title}</p>}
                        <p className="task-meta">
                          {prog.total > 0 ? `${prog.done}/${prog.total} tasks` : 'no tasks yet'}
                          {q.targetDate && ` · ${daysUntil(q.targetDate)}`}
                        </p>
                      </div>
                      <span className="quest-card-pct">{prog.pct}%</span>
                    </div>
                    <div className="arena-race-track" style={{ height: 8 }}>
                      <div className="arena-race-fill you" style={{ width: `${prog.pct}%` }} />
                    </div>

                    {isOpen && (
                      <div className="quest-card-body">
                        {q.why && <p className="quest-why">&quot;{q.why}&quot;</p>}
                        {q.tasks.map(t => (
                          <div className={`task-row ${t.isDone ? 'done' : ''}`} key={t.id}>
                            <button
                              className={`task-check ${t.isDone ? 'checked' : ''}`}
                              onClick={() => handleToggle(t)}
                              aria-label="toggle task"
                            >{t.isDone ? '✓' : ''}</button>
                            <div className="task-body">
                              <span className="task-title">{t.title}</span>
                              <span className="task-meta">
                                <span style={{ color: TASK_PRIORITY_META[t.priority].color }}>{TASK_PRIORITY_META[t.priority].label}</span>
                                {t.doDate && <> · {daysUntil(t.doDate)}</>}
                              </span>
                            </div>
                            <button className="task-delete" onClick={() => deleteTask(t.id).then(load)} aria-label="delete task">✕</button>
                          </div>
                        ))}
                        <div className="arena-code-row">
                          <input
                            className="arena-input"
                            style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 600, fontSize: 14 }}
                            placeholder="Add a task..."
                            value={newTaskTitles[q.id] ?? ''}
                            onChange={e => setNewTaskTitles(prev => ({ ...prev, [q.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleAddToQuest(q.id)}
                          />
                          <button className="arena-btn accept" onClick={() => handleAddToQuest(q.id)}>+</button>
                        </div>
                        <div className="arena-actions">
                          <button className="arena-btn accept" onClick={() => handleComplete(q)}>
                            COMPLETE {QUEST_TYPE_META[q.questType].emoji} +{QUEST_TYPE_META[q.questType].reward}
                          </button>
                          <button className="arena-btn decline" onClick={() => handleKill(q)}>KILL</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {activeQuests.length === 0 && (
          <div className="arena-empty">
            <div style={{ fontSize: 44 }}>🎯</div>
            <h3>No active quests</h3>
            <p>Your body is training. Time to give the rest of your life the same treatment.</p>
          </div>
        )}

        {closedQuests.length > 0 && (
          <>
            <h4 className="arena-section-title">CLOSED</h4>
            {closedQuests.map(q => (
              <div className="arena-past" key={q.id}>
                <span>{q.status === 'done' ? '🏆' : '🪦'}</span>
                <span className="arena-past-name">{q.title}</span>
                <span className={`arena-past-result ${q.status === 'done' ? 'win' : ''}`}>
                  {q.status === 'done' ? 'DONE' : 'KILLED'}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* New quest sheet */}
      {sheetOpen && (
        <div className="sheet-overlay" onClick={() => setSheetOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 className="sheet-title">NEW QUEST</h3>

            <p className="sheet-label">WHAT&apos;S THE GOAL?</p>
            <input
              className="arena-input" style={{ width: '100%', letterSpacing: 0, textTransform: 'none', fontWeight: 600 }}
              placeholder="e.g. Launch RetailGPT"
              value={qTitle} onChange={e => setQTitle(e.target.value)}
            />

            <p className="sheet-label">WHY IT MATTERS (you&apos;ll see this when you want to quit)</p>
            <textarea
              className="arena-input" rows={2}
              style={{ width: '100%', letterSpacing: 0, textTransform: 'none', fontWeight: 500, fontSize: 14, resize: 'none', fontFamily: 'inherit' }}
              placeholder="The real reason..."
              value={qWhy} onChange={e => setQWhy(e.target.value)}
            />

            <p className="sheet-label">HORIZON</p>
            <div className="sheet-options">
              {TYPE_ORDER.map(t => (
                <button key={t} className={`sheet-opt ${qType === t ? 'active' : ''}`} onClick={() => setQType(t)}>
                  {QUEST_TYPE_META[t].emoji} {QUEST_TYPE_META[t].label}
                </button>
              ))}
            </div>

            <p className="sheet-label">TARGET DATE (OPTIONAL)</p>
            <input
              type="date" className="nutri-num" style={{ colorScheme: 'dark' }}
              value={qTarget} onChange={e => setQTarget(e.target.value)}
            />

            {qType !== 'north_star' && activeQuests.some(q => q.questType !== 'monthly') && (
              <>
                <p className="sheet-label">PART OF (OPTIONAL)</p>
                <select className="nutri-select" value={qParent} onChange={e => setQParent(e.target.value)}>
                  <option value="">— standalone —</option>
                  {activeQuests
                    .filter(p => TYPE_ORDER.indexOf(p.questType) < TYPE_ORDER.indexOf(qType))
                    .map(p => <option key={p.id} value={p.id}>{QUEST_TYPE_META[p.questType].emoji} {p.title}</option>)}
                </select>
              </>
            )}

            {!suggested && (
              <button
                className="arena-btn accept" style={{ width: '100%', marginTop: 16, padding: 14 }}
                disabled={!qTitle.trim() || breakingDown}
                onClick={handleBreakdown}
              >
                {breakingDown ? 'THINKING...' : '✨ AI: BREAK IT INTO FIRST TASKS'}
              </button>
            )}

            {suggested && (
              <>
                <p className="sheet-label">SUGGESTED FIRST TASKS (tap to include/exclude)</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {suggested.map((t, i) => (
                    <button
                      key={i}
                      className={`sheet-opt ${suggestedOn.has(i) ? 'active' : ''}`}
                      style={{ textAlign: 'left' }}
                      onClick={() => setSuggestedOn(prev => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i); else next.add(i);
                        return next;
                      })}
                    >
                      {suggestedOn.has(i) ? '✓ ' : ''}{t.title}
                      <span style={{ color: 'var(--text3)', fontSize: 11 }}> · {TASK_PRIORITY_META[t.priority].label} · {t.dueOffsetDays === 0 ? 'today' : `+${t.dueOffsetDays}d`}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <button className="btn-primary" style={{ marginTop: 16 }} disabled={!qTitle.trim() || creating} onClick={handleCreateQuest}>
              {creating ? 'CREATING...' : 'START QUEST 🎯'}
            </button>
          </div>
        </div>
      )}

      <BottomNav active="quests" />
    </>
  );
}
