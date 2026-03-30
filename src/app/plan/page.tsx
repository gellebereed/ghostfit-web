'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentPlan, getProfile, savePlan } from '@/lib/db';
import { WorkoutPlan, Exercise } from '@/lib/types';

export default function PlanPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [goal, setGoal] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showRegen, setShowRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [dragFrom, setDragFrom] = useState<{ dayIdx: number; exIdx: number } | null>(null);

  // Upgrade: Add Exercise state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [dayToAddTo, setDayToAddTo] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  // AI state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);

  const COMMON_EXERCISES = [
    'Treadmill (Run)', 'Spin Bike', 'Rowing Machine', 'Elliptical', 'Jump Rope',
    'Pushups', 'Pullups', 'Squats', 'Deadlift', 'Bench Press', 'Shoulder Press', 'Bicep Curls', 'Tricep Pulldowns',
    'Lunge', 'Plank', 'Crunches', 'Dumbbell Row', 'Leg Press', 'Hamstring Curls', 'Lat Pulldowns', 'Dips', 'Burpees',
    'Mountain Climbers', 'Incline Press', 'Hammer Curls', 'Lateral Raises', 'Face Pulls', 'Russian Twists', 'Kettlebell Swings'
  ];

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const p = await getCurrentPlan();
      setPlan(p);
      const profile = await getProfile();
      if (profile) { setGoal(profile.goal); setEquipment(profile.equipment); }
    } catch (err) {
      console.error('Plan load error:', err);
    } finally {
      setReady(true);
    }
  }

  async function getAiSuggestions() {
    if (!aiPrompt) return;
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const res = await fetch('/api/suggest-exercise', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, equipment, goal }),
      });
      const data = await res.json();
      if (data.suggestions) setAiSuggestions(data.suggestions);
    } catch {}
    setAiLoading(false);
  }

  async function regenerate() {
    setShowRegen(false);
    setRegenerating(true);
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment, goal }),
      });
      if (res.ok) {
        const newPlan = await res.json();
        await savePlan({ ...newPlan, createdAt: Date.now() });
        setPlan({ ...newPlan, createdAt: Date.now() });
      }
    } catch {}
    setRegenerating(false);
    setEditing(false);
  }

  async function saveEdits() {
    if (plan) {
      await savePlan(plan);
      setEditing(false);
    }
  }

  function updateExercise(dayIdx: number, exIdx: number, field: keyof Exercise, value: any) {
    if (!plan) return;
    const newPlan = { ...plan, days: plan.days.map((d, di) => di !== dayIdx ? d : {
      ...d, exercises: d.exercises.map((ex, ei) => ei !== exIdx ? ex : { ...ex, [field]: value })
    })};
    setPlan(newPlan);
  }

  function removeExercise(dayIdx: number, exIdx: number) {
    if (!plan) return;
    const newPlan = { ...plan, days: plan.days.map((d, di) => di !== dayIdx ? d : {
      ...d, exercises: d.exercises.filter((_, ei) => ei !== exIdx)
    })};
    setPlan(newPlan);
  }

  function addExercise(dayIdx: number, item: any) {
    if (!plan) return;
    const name = typeof item === 'string' ? item : item.name;
    const type = typeof item === 'string' ? (item.match(/treadmill|bike|row|run|walk|elliptical|rope/i) ? 'cardio' : 'strength') : item.type;

    const newPlan = { ...plan, days: plan.days.map((d, di) => di !== dayIdx ? d : {
      ...d, exercises: [...d.exercises, {
        name,
        sets: type === 'cardio' ? 1 : 3,
        reps: type === 'cardio' ? 1 : 10,
        durationSeconds: type === 'cardio' ? 600 : 0,
        type: type as any,
        equipment: typeof item === 'string' ? 'Any' : item.equipmentNeeded || 'Any'
      }]
    })};
    setPlan(newPlan);
    setShowAddSheet(false);
    setSearch('');
    setAiPrompt('');
    setAiSuggestions([]);
  }

  function toggleRest(dayIdx: number) {
    if (!plan) return;
    const newPlan = { ...plan, days: plan.days.map((d, di) => di !== dayIdx ? d : { ...d, isRest: !d.isRest })};
    setPlan(newPlan);
  }

  function handleDrop(dayIdx: number, dropIdx: number) {
    if (!dragFrom || !plan || dragFrom.dayIdx !== dayIdx || dragFrom.exIdx === dropIdx) {
      setDragFrom(null); return;
    }
    const newPlan = { ...plan, days: plan.days.map((d, di) => {
      if (di !== dayIdx) return d;
      const exs = [...d.exercises];
      const [moved] = exs.splice(dragFrom.exIdx, 1);
      exs.splice(dropIdx, 0, moved);
      return { ...d, exercises: exs };
    })};
    setPlan(newPlan);
    setDragFrom(null);
  }

  if (regenerating) return (
    <div className="plan-loading"><div className="plan-spinner" /><h2>REBUILDING <span className="green">YOUR</span> PLAN...</h2><p>Generating fresh workouts</p></div>
  );

  if (!ready) return <div className="loading"><div className="loader" /></div>;
  if (!plan) return <div className="page"><div className="empty"><div className="icon">👻</div><h3>No plan yet</h3><p>Complete onboarding to generate your plan</p></div><Link href="/" className="btn-outline" style={{ margin: '0 20px' }}>← Back Home</Link></div>;

  const todayNum = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const goalLabel = goal === 'shredded' ? 'Get Shredded' : goal === 'muscle' ? 'Build Muscle' : goal === 'strength' ? 'Get Stronger' : 'Improve Fitness';
  const available = COMMON_EXERCISES.filter(e => e.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Search Sheet */}
      {showAddSheet && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setShowAddSheet(false)} />
          <div className="bottom-sheet" style={{ zIndex: 300, minHeight: '60vh' }}>
            <div style={{ padding: '16px 16px 8px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, marginBottom: 8 }}>AI SUGGESTIONS 🤖</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="name-input" style={{ flex: 1, padding: 10, fontSize: 13, textAlign: 'left' }}
                  placeholder="e.g. exercises for chest and back..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                <button className="btn-primary" style={{ width: 'auto', padding: '0 12px', fontSize: 12 }} onClick={getAiSuggestions} disabled={aiLoading || !aiPrompt}>
                  {aiLoading ? '...' : 'Ask'}
                </button>
              </div>
              {aiLoading && <div className="loader" style={{ margin: '12px auto' }} />}
              {aiSuggestions.map((s, i) => (
                <div key={i} className="search-result" onClick={() => addExercise(dayToAddTo!, s)}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 700 }}>{s.name} <span style={{ fontSize: 9, opacity: 0.6 }}>({s.type})</span></span>
                    <span style={{ fontSize: 10, color: s.isEquipmentOwned ? 'var(--accent)' : 'var(--loss-red)' }}>
                      Requires: {s.equipmentNeeded} {!s.isEquipmentOwned && ' (⚠️ You don\'t have this)'}
                    </span>
                    <span style={{ fontSize: 10, opacity: 0.7 }}>{s.reason}</span>
                  </div>
                  <div style={{ color: 'var(--accent)' }}>+</div>
                </div>
              ))}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />

            <div style={{ padding: '0 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: 1, margin: '8px 0' }}>COMMON EXERCISES</div>
              <input className="search-input" style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}
                placeholder="Search or add custom..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && !available.includes(search) && (
                <div className="search-result" style={{ color: 'var(--accent)' }} onClick={() => addExercise(dayToAddTo!, search)}>
                  <span>+ Create &quot;{search}&quot;</span>
                </div>
              )}
              {available.map(e => (
                <div key={e} className="search-result" onClick={() => addExercise(dayToAddTo!, e)}>
                  <span>{e}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <header className="hdr">
        <Link href="/settings" className="hdr-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </Link>
        <span style={{ fontSize: 16, fontWeight: 800 }}>My Workout Plan</span>
        <div style={{ width: 20 }} />
      </header>

      <div style={{ padding: '8px 20px', fontSize: 12, color: 'var(--text2)' }}>
        Week {plan.weekNumber} · Generated for {goalLabel}
      </div>

      <div className="plan-actions">
        <button className="btn-outline" onClick={() => editing ? saveEdits() : setEditing(true)} style={{ fontSize: 12, padding: 12 }}>
          {editing ? '💾 Save Changes' : '✏️ Edit Plan'}
        </button>
        <button className="btn-outline" onClick={() => setShowRegen(true)} style={{ fontSize: 12, padding: 12 }}>
          🔄 Regenerate
        </button>
      </div>

      {plan.days.map((day, di) => (
        <div key={di} className={`day-card ${day.dayNumber === todayNum ? 'today-highlight' : ''}`}>
          <div className="day-card-header">
            <h3>{day.dayName} · {day.isRest ? '🛌 Rest' : day.focus}</h3>
            {editing && (
              <button className="btn-ghost" onClick={() => toggleRest(di)} style={{ fontSize: 10, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6 }}>
                {day.isRest ? 'Make Active' : 'Make Rest'}
              </button>
            )}
            {!editing && day.dayNumber === todayNum && <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 11 }}>TODAY</span>}
          </div>
          {!day.isRest && day.exercises.map((ex, ei) => (
            <div
              className="day-card-ex" key={ei}
              draggable={editing}
              onDragStart={() => setDragFrom({ dayIdx: di, exIdx: ei })}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(di, ei)}
              style={{ opacity: dragFrom?.dayIdx === di && dragFrom?.exIdx === ei ? 0.4 : 1, cursor: editing ? 'grab' : undefined }}
            >
              {editing && (
                <span style={{ color: 'var(--text3)', fontSize: 14, marginRight: 6, cursor: 'grab', userSelect: 'none' }}>⠿</span>
              )}
              <span className="ex-name" style={{ fontSize: 12, flex: 1 }}>{ex.name}</span>
              {editing ? (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button className="btn-ghost" style={{ fontSize: 9, padding: '2px 4px', border: '1px solid var(--border)', borderRadius: 4, color: ex.type === 'cardio' ? 'var(--accent)' : 'var(--text3)' }}
                    onClick={() => updateExercise(di, ei, 'type', ex.type === 'cardio' ? 'strength' : 'cardio')}>
                    {ex.type === 'cardio' ? 'CARDIO' : 'STR'}
                  </button>
                  {ex.type === 'cardio' ? (
                    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <input type="number" value={Math.round((ex.durationSeconds || 600) / 60)} onChange={e => updateExercise(di, ei, 'durationSeconds', (parseInt(e.target.value) || 1) * 60)}
                        style={{ width: 36, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', textAlign: 'center', padding: '4px', fontSize: 11, fontFamily: 'inherit' }} />
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>min</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <input type="number" value={ex.sets} onChange={e => updateExercise(di, ei, 'sets', parseInt(e.target.value) || 1)}
                        style={{ width: 28, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', textAlign: 'center', padding: '4px', fontSize: 11, fontFamily: 'inherit' }} />
                      <span style={{ fontSize: 10, padding: '0 1px' }}>×</span>
                      <input type="number" value={ex.reps} onChange={e => updateExercise(di, ei, 'reps', parseInt(e.target.value) || 1)}
                        style={{ width: 32, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', textAlign: 'center', padding: '4px', fontSize: 11, fontFamily: 'inherit' }} />
                    </div>
                  )}
                  <button className="btn-ghost" onClick={() => removeExercise(di, ei)} style={{ color: 'var(--loss-red)', fontSize: 14 }}>🗑️</button>
                </div>
              ) : (
                <span className="ex-reps" style={{ fontSize: 11 }}>{ex.type === 'cardio' ? `${Math.round((ex.durationSeconds || 300) / 60)} min` : `${ex.sets} × ${ex.reps}`}</span>
              )}
            </div>
          ))}
          {editing && !day.isRest && (
            <button className="add-exercise-btn" onClick={() => { setDayToAddTo(di); setShowAddSheet(true); }}>
              + Add Exercise
            </button>
          )}
        </div>
      ))}

      {/* Regenerate Confirm */}
      {showRegen && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Generate a fresh plan?</h3>
            <p>Based on your current equipment ({equipment.length} items) and goal ({goalLabel}). Ghost history is preserved.</p>
            <div className="dialog-btns">
              <button className="give-up" onClick={() => setShowRegen(false)}>Cancel</button>
              <button className="keep" onClick={regenerate}>Generate New Plan →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
