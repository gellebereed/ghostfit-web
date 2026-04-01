'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentPlan, getProfile, savePlan } from '@/lib/db';
import { WorkoutPlan, Exercise } from '@/lib/types';

// DND Kit Imports
import {
  DndContext,
  closestCenter,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const dayNames = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday'
];

function formatExerciseDetail(exercise: Exercise): string {
  if (exercise.metricType === 'duration') {
    const secs = exercise.durationSeconds ?? 30;
    const display = secs >= 60 
      ? `${Math.floor(secs/60)}min ${secs%60 > 0 ? secs%60+'s' : ''}`.trim()
      : `${secs}s`;
    return `${exercise.sets ?? 3} × ${display}`;
  }
  
  if (exercise.type === 'cardio') {
    return `${Math.round((exercise.durationSeconds || 600) / 60)} min`;
  }
  
  // Safety check — never show "undefined"
  const reps = exercise.reps ?? 10;
  const sets = exercise.sets ?? 3;
  return `${sets} × ${reps}`;
}

// --- Sortable Item Component ---
function SortableExerciseRow({ 
  exercise, 
  dayIdx, 
  exIdx, 
  editing, 
  onDelete, 
  onUpdate 
}: { 
  exercise: Exercise & { id?: string }, 
  dayIdx: number, 
  exIdx: number, 
  editing: boolean, 
  onDelete: (idx: number) => void, 
  onUpdate: (idx: number, field: keyof Exercise, val: any) => void 
}) {
  const itemId = exercise.id || `${exercise.name}-${dayIdx}-${exIdx}`;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: itemId, disabled: !editing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : 'auto',
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="day-card-ex">
      {editing && (
        <div
          {...attributes}
          {...listeners}
          style={{ 
            color: 'var(--text3)', 
            fontSize: 18, 
            marginRight: 10, 
            cursor: 'grab', 
            userSelect: 'none',
            padding: '8px 4px',
            touchAction: 'none'
          }}
        >
          ⠿
        </div>
      )}
      <span className="ex-name" style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {exercise.name}
      </span>
      {editing ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className="btn-ghost" style={{ fontSize: 9, padding: '2px 4px', border: '1px solid var(--border)', borderRadius: 4, color: exercise.type === 'cardio' ? 'var(--accent)' : 'var(--text3)' }}
            onClick={() => onUpdate(exIdx, 'type', exercise.type === 'cardio' ? 'strength' : 'cardio')}>
            {exercise.type === 'cardio' ? 'CARDIO' : 'STR'}
          </button>
          {exercise.type === 'cardio' ? (
            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <input type="number" value={Math.round((exercise.durationSeconds || 600) / 60)} 
                onChange={e => onUpdate(exIdx, 'durationSeconds', (parseInt(e.target.value) || 1) * 60)}
                inputMode="numeric"
                style={{ width: 36, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', textAlign: 'center', padding: '4px', fontSize: 11, fontFamily: 'inherit' }} />
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>min</span>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <input type="number" value={exercise.sets ?? 3} 
                onChange={e => onUpdate(exIdx, 'sets', parseInt(e.target.value) || 1)}
                inputMode="numeric"
                style={{ width: 28, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', textAlign: 'center', padding: '4px', fontSize: 11, fontFamily: 'inherit' }} />
              <span style={{ fontSize: 10, padding: '0 1px' }}>×</span>
              <input type="number" value={exercise.reps ?? 10} 
                onChange={e => onUpdate(exIdx, 'reps', parseInt(e.target.value) || 1)}
                inputMode="numeric"
                style={{ width: 32, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', textAlign: 'center', padding: '4px', fontSize: 11, fontFamily: 'inherit' }} />
            </div>
          )}
          <button className="btn-ghost" onClick={() => onDelete(exIdx)} style={{ color: 'var(--loss-red)', fontSize: 14 }}>🗑️</button>
        </div>
      ) : (
        <span className="ex-reps" style={{ fontSize: 11 }}>
          {formatExerciseDetail(exercise)}
        </span>
      )}
    </div>
  );
}

export default function PlanPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [goal, setGoal] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showRegen, setShowRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Upgrade: Add Exercise state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [dayToAddTo, setDayToAddTo] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [newExEquipment, setNewExEquipment] = useState('');

  // AI state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);

  // Move Day state
  const [movingDay, setMovingDay] = useState<number | null>(null);

  // DND Kit Sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      }
    })
  );

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
      if (profile) { 
        setGoal(profile.goal); 
        setEquipment(profile.equipment);
        if (profile.equipment.length > 0) setNewExEquipment(profile.equipment[0]);
        else setNewExEquipment('Bodyweight');
      }
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
        metricType: (type === 'cardio' ? 'cardio' : 'weight_reps') as any,
        equipment: typeof item === 'string' ? newExEquipment : item.equipmentNeeded || newExEquipment
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

  function swapDays(idxA: number, idxB: number) {
    if (!plan) return;
    const newDays = [...plan.days];
    const tempFocus = newDays[idxA].focus;
    const tempExercises = newDays[idxA].exercises;
    const tempIsRest = newDays[idxA].isRest;
    
    newDays[idxA] = {
      ...newDays[idxA],
      focus: newDays[idxB].focus,
      exercises: newDays[idxB].exercises,
      isRest: newDays[idxB].isRest
    };
    newDays[idxB] = {
      ...newDays[idxB],
      focus: tempFocus,
      exercises: tempExercises,
      isRest: tempIsRest
    };
    
    setPlan({ ...plan, days: newDays });
  }

  function handleExerciseReorder(dayIdx: number, activeId: string, overId: string) {
    if (!plan || activeId === overId) return;
    
    const day = plan.days[dayIdx];
    const oldIdx = day.exercises.findIndex((e, ei) => ( (e as any).id || `${e.name}-${dayIdx}-${ei}`) === activeId);
    const newIdx = day.exercises.findIndex((e, ei) => ( (e as any).id || `${e.name}-${dayIdx}-${ei}`) === overId);
    
    if (oldIdx !== -1 && newIdx !== -1) {
      const newPlan = { ...plan, days: plan.days.map((d, di) => di !== dayIdx ? d : {
        ...d, exercises: arrayMove(d.exercises, oldIdx, newIdx)
      })};
      setPlan(newPlan);
    }
  }

  if (regenerating) return (
    <div className="plan-loading"><div className="plan-spinner" /><h2>REBUILDING <span className="green">YOUR</span> PLAN...</h2><p>Generating fresh workouts</p></div>
  );

  if (!ready) return <div className="loading"><div className="loader" /></div>;
  if (!plan) return <div className="page"><div className="empty"><div className="icon">👻</div><h3>No plan yet</h3><p>Complete onboarding to generate your plan</p></div><Link href="/" className="btn-outline" style={{ margin: '0 20px' }}>← Back Home</Link></div>;

  const todayDayName = dayNames[new Date().getDay()];
  const isTodayCard = (dayName: string): boolean => {
    return dayName === todayDayName;
  };

  const goalLabel = goal === 'shredded' ? 'Get Shredded' : goal === 'muscle' ? 'Build Muscle' : goal === 'strength' ? 'Get Stronger' : 'Improve Fitness';
  const available = COMMON_EXERCISES.filter(e => e.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Search/Add Exercise Sheet */}
      {showAddSheet && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setShowAddSheet(false)} />
          <div className="bottom-sheet" style={{ zIndex: 300, minHeight: '70vh' }}>
            <div style={{ padding: '16px 16px 8px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, marginBottom: 8 }}>ADD NEW EXERCISE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Equipment</label>
                  <select 
                    value={newExEquipment} 
                    onChange={e => setNewExEquipment(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', padding: '12px', fontSize: 13, appearance: 'none', backgroundImage: 'linear-gradient(45deg, transparent 50%, var(--text3) 50%), linear-gradient(135deg, var(--text3) 50%, transparent 50%)', backgroundPosition: 'calc(100% - 20px) calc(1em + 2px), calc(100% - 15px) calc(1em + 2px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                  >
                    {equipment.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                    <option value="Bodyweight">Bodyweight</option>
                  </select>
                </div>
              </div>

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

      {/* Swap Day Sheet */}
      {movingDay !== null && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setMovingDay(null)} />
          <div className="bottom-sheet" style={{ zIndex: 300 }}>
            <div style={{ padding: '20px' }}>
              <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 20px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Swap {plan.days[movingDay].dayName} with...</h3>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>Workouts and rest days will be exchanged</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plan.days.map((day, idx) => {
                  if (idx === movingDay) return null;
                  return (
                    <button 
                      key={idx} 
                      onClick={() => { swapDays(movingDay, idx); setMovingDay(null); }}
                      style={{ 
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'between',
                        padding: '16px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)',
                        textAlign: 'left', cursor: 'pointer', transition: 'var(--t)'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{day.dayName}</p>
                        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                          {day.isRest ? '😴 Rest day' : `${day.focus} · ${day.exercises.length} exercises`}
                        </p>
                      </div>
                      <span style={{ color: 'var(--accent)', fontSize: 18 }}>⇄</span>
                    </button>
                  );
                })}
              </div>
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
        <div key={di} className={`day-card ${isTodayCard(day.dayName) ? 'today-highlight' : ''}`}>
          <div className="day-card-header">
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 14 }}>{day.dayName} · {day.isRest ? '🛌 Rest' : day.focus}</h3>
              {day.isRest && !editing && <span style={{ color: 'var(--text3)', fontSize: 10 }}>Rest Day</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {editing && (
                <>
                  <button 
                    className="btn-ghost" 
                    onClick={() => setMovingDay(di)}
                    style={{ fontSize: 10, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)' }}
                  >
                    ⇄ Swap
                  </button>
                  <button className="btn-ghost" onClick={() => toggleRest(di)} style={{ fontSize: 10, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6 }}>
                    {day.isRest ? '💪 Activate' : '😴 Rest'}
                  </button>
                </>
              )}
              {!editing && isTodayCard(day.dayName) && <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 11 }}>TODAY</span>}
            </div>
          </div>
          {!day.isRest && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => {
                if (over) handleExerciseReorder(di, active.id as string, over.id as string);
              }}
            >
              <SortableContext
                items={day.exercises.map((e, ei) => (e as any).id || `${e.name}-${di}-${ei}`)}
                strategy={verticalListSortingStrategy}
              >
                {day.exercises.map((exercise, ei) => (
                  <SortableExerciseRow
                    key={(exercise as any).id || `${exercise.name}-${di}-${ei}`}
                    exercise={exercise}
                    dayIdx={di}
                    exIdx={ei}
                    editing={editing}
                    onDelete={idx => removeExercise(di, idx)}
                    onUpdate={(idx, f, v) => updateExercise(di, idx, f, v)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
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
