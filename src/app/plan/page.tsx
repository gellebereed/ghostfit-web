'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCurrentPlan, getProfile, saveProfile, savePlan } from '@/lib/db';
import { generateAndSavePlan } from '@/lib/plan-actions';
import { getProgramState, saveProgramState, type ProgramState } from '@/lib/program-state';
import { AUDITED_MUSCLES, getGoalProfile, normalizeExperience, selectSplit, volumeVerdict } from '@/lib/training-science';
import {
  FOCUS_AREA_LIST, FOCUS_AREAS, FOCUS_FREQUENCY_META,
  type FocusAreaId, type FocusFrequency,
} from '@/lib/focus-library';
import {
  MUSCLE_LABELS, PHASE_META,
  type CooldownStep, type Exercise, type ExperienceLevel, type MuscleGroup,
  type WarmupStep, type WorkoutDay, type WorkoutPlan,
} from '@/lib/types';

// DND Kit Imports
import {
  DndContext,
  closestCenter,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const GOALS = [
  { id: 'strength', label: 'Strength' },
  { id: 'muscle', label: 'Muscle' },
  { id: 'shredded', label: 'Shredded' },
  { id: 'fitness', label: 'Fitness' },
];

const STAGE_LABELS: Record<WarmupStep['stage'], string> = {
  raise: 'Raise',
  mobilise: 'Mobilise',
  activate: 'Activate',
  potentiate: 'Potentiate',
};

type EditableExercise = Exercise & { id?: string };
interface ExerciseSuggestion {
  name: string;
  type?: Exercise['type'];
  equipmentNeeded?: string;
  isEquipmentOwned?: boolean;
  reason?: string;
}

function exerciseId(exercise: Exercise, dayIdx: number, exIdx: number): string {
  return (exercise as EditableExercise).id || `${exercise.name}-${dayIdx}-${exIdx}`;
}

function formatSeconds(secs: number): string {
  if (secs >= 60) {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return rem ? `${mins}m ${rem}s` : `${mins} min`;
  }
  return `${secs}s`;
}

function formatExerciseDetail(exercise: Exercise): string {
  if (exercise.metricType === 'duration') {
    return `${exercise.sets ?? 3} × ${formatSeconds(exercise.durationSeconds ?? 30)}`;
  }
  if (exercise.type === 'cardio' || exercise.metricType === 'cardio') {
    return formatSeconds(exercise.durationSeconds ?? 600);
  }
  const sets = exercise.sets ?? 3;
  // A prescribed range is the honest target — a single number hides the
  // progression rule that makes the set worth logging.
  if (exercise.repMin && exercise.repMax && exercise.repMin !== exercise.repMax) {
    return `${sets} × ${exercise.repMin}–${exercise.repMax}`;
  }
  return `${sets} × ${exercise.reps ?? 10}`;
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
  onUpdate: (idx: number, field: keyof Exercise, val: Exercise[keyof Exercise]) => void
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

  const chips: string[] = [];
  if (exercise.block === 'focus') chips.push('⭐ Focus block');
  if (exercise.restSeconds) chips.push(`⏱ ${formatSeconds(exercise.restSeconds)} rest`);
  if (exercise.targetRir !== undefined) {
    chips.push(exercise.targetRir === 0 ? '💥 To failure' : `🎯 ${exercise.targetRir} reps in reserve`);
  }
  if (exercise.tempo) chips.push(`🕒 ${exercise.tempo}`);
  if (exercise.supersetGroup) chips.push('🔗 Superset');

  return (
    <div ref={setNodeRef} style={style} className="plan-ex-row">
      <div className="day-card-ex" style={{ borderBottom: 'none', paddingBottom: 2 }}>
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
      {!editing && chips.length > 0 && (
        <div className="plan-ex-chips">
          {chips.map(chip => <span key={chip} className="plan-chip-mini">{chip}</span>)}
        </div>
      )}
    </div>
  );
}

function WarmupBlock({ steps }: { steps: WarmupStep[] }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length) return null;
  const total = Math.round(steps.reduce((s, x) => s + x.durationSeconds * (x.perSide ? 2 : 1), 0) / 60);

  return (
    <div className="prep-block warm">
      <button className="prep-head" onClick={() => setOpen(!open)}>
        <span className="prep-title">🔥 Warm-up · {total} min</span>
        <span className="prep-toggle">{open ? '−' : '+'}</span>
      </button>
      {!open && <p className="prep-hint">RAMP protocol — raise, mobilise, activate, then ramp-up sets.</p>}
      {open && (
        <div className="prep-list">
          {steps.map(step => (
            <div key={step.id} className="prep-row">
              <span className="prep-stage">{STAGE_LABELS[step.stage]}</span>
              <div className="prep-body">
                <p className="prep-name">
                  {step.name}
                  <span className="prep-dose">
                    {step.reps ? ` · ${step.reps} reps` : ` · ${formatSeconds(step.durationSeconds)}`}
                    {step.perSide ? ' each side' : ''}
                  </span>
                </p>
                <p className="prep-cue">{step.cue}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CooldownBlock({ steps, restDay }: { steps: CooldownStep[]; restDay?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length) return null;
  const total = Math.round(steps.reduce((s, x) => s + x.holdSeconds * (x.perSide ? 2 : 1), 0) / 60);

  return (
    <div className="prep-block cool">
      <button className="prep-head" onClick={() => setOpen(!open)}>
        <span className="prep-title">🧘 {restDay ? 'Mobility flow' : 'Cool-down & stretch'} · {total} min</span>
        <span className="prep-toggle">{open ? '−' : '+'}</span>
      </button>
      {!open && <p className="prep-hint">The stretches that decide how tomorrow feels.</p>}
      {open && (
        <div className="prep-list">
          {steps.map(step => (
            <div key={step.id} className="prep-row">
              <span className="prep-stage cool">{step.kind === 'breathing' ? 'Breathe' : 'Hold'}</span>
              <div className="prep-body">
                <p className="prep-name">
                  {step.name}
                  <span className="prep-dose">
                    {' · '}{formatSeconds(step.holdSeconds)}{step.perSide ? ' each side' : ''}
                  </span>
                </p>
                <p className="prep-cue">{step.cue}</p>
                <p className="prep-relief">{step.relief}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VolumeAudit({ plan }: { plan: WorkoutPlan }) {
  const meta = plan.meta;
  if (!meta) return null;
  const target = getGoalProfile(meta.goal).weeklySetTarget;
  const rows = AUDITED_MUSCLES
    .map(m => ({ muscle: m, sets: meta.weeklySets[m] ?? 0 }))
    .filter(r => r.sets > 0)
    .sort((a, b) => b.sets - a.sets);
  if (rows.length === 0) return null;

  return (
    <details className="plan-audit">
      <summary>📊 Weekly volume audit · target ~{target} hard sets per muscle</summary>
      <div className="plan-audit-grid">
        {rows.map(({ muscle, sets }) => {
          const verdict = volumeVerdict(sets, target);
          return (
            <div key={muscle} className={`plan-audit-row ${verdict}`}>
              <span>{MUSCLE_LABELS[muscle as MuscleGroup]}</span>
              <div className="plan-audit-track">
                <div className="plan-audit-fill" style={{ width: `${Math.min(100, (sets / (target * 1.5)) * 100)}%` }} />
              </div>
              <strong>{sets}</strong>
            </div>
          );
        })}
      </div>
      <p className="plan-audit-note">
        Hard sets counted per muscle across the week. Secondary movers count half — they work, but they are not the limiter.
      </p>
    </details>
  );
}

export default function PlanPage() {
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [goal, setGoal] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showRegen, setShowRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [program, setProgram] = useState<ProgramState | null>(null);
  const [showTune, setShowTune] = useState(false);
  // Tune-sheet drafts — nothing is committed until "Rebuild my week".
  const [draftDays, setDraftDays] = useState<number[]>([]);
  const [draftTime, setDraftTime] = useState('');
  const [draftGoal, setDraftGoal] = useState('');
  const [draftFocus, setDraftFocus] = useState<FocusAreaId | null>(null);
  const [draftFocusFreq, setDraftFocusFreq] = useState<FocusFrequency>('standard');

  // Upgrade: Add Exercise state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [dayToAddTo, setDayToAddTo] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [newExEquipment, setNewExEquipment] = useState('');

  // AI state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<ExerciseSuggestion[]>([]);

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
      const state = getProgramState();
      setProgram(state);
      setDraftFocus(state.focusArea);
      setDraftFocusFreq(state.focusFrequency);

      // Seed the tune drafts from what is actually programmed right now, so
      // opening the sheet shows the truth rather than a default.
      setDraftDays(
        state.trainingDayIndices
        ?? p?.days.filter(d => !d.isRest).map(d => dayNames.indexOf(d.dayName)).filter(i => i >= 0)
        ?? [],
      );

      const profile = await getProfile();
      if (profile) {
        setGoal(profile.goal);
        setDraftGoal(getGoalProfile(profile.goal).id);
        setDraftTime(profile.commitmentTime ?? '');
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

  /** Commit every tune-sheet change in one rebuild. */
  async function applyTune() {
    if (!program || draftDays.length < 2) return;
    setShowTune(false);
    setRegenerating(true);
    try {
      const profile = await getProfile();
      const goalChanged = profile ? getGoalProfile(profile.goal).id !== draftGoal : false;

      if (profile) {
        await saveProfile({
          ...profile,
          goal: draftGoal,
          commitmentTime: draftTime || null,
          ...(goalChanged ? { currentWeek: 1 } : {}),
        });
      }

      const next = await generateAndSavePlan({
        equipment,
        goal: draftGoal,
        experience: program.experience,
        sessionMinutes: program.sessionMinutes,
        trainingDayIndices: draftDays,
        focusArea: draftFocus,
        focusFrequency: draftFocusFreq,
        // A different goal means different prescriptions — the volume ramp
        // restarts rather than resuming mid-climb on numbers you never ran.
        restartCycle: goalChanged,
      });
      setPlan(next);
      setGoal(draftGoal);
      setProgram(getProgramState());
    } catch (err) {
      console.error('Tune failed:', err);
    }
    setRegenerating(false);
    setEditing(false);
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

  async function regenerate(overrides?: Partial<Pick<ProgramState, 'trainingDays' | 'sessionMinutes' | 'experience'>>) {
    setShowRegen(false);
    setShowTune(false);
    setRegenerating(true);
    try {
      if (overrides) saveProgramState(overrides);
      const next = await generateAndSavePlan({
        equipment,
        goal,
        ...overrides,
      });
      setPlan(next);
      setProgram(getProgramState());
    } catch (err) {
      console.error('Regenerate failed:', err);
    }
    setRegenerating(false);
    setEditing(false);
  }

  async function saveEdits() {
    if (plan) {
      await savePlan(plan);
      setEditing(false);
    }
  }

  function updateExercise(dayIdx: number, exIdx: number, field: keyof Exercise, value: Exercise[keyof Exercise]) {
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

  function addExercise(dayIdx: number, item: string | ExerciseSuggestion) {
    if (!plan) return;
    const name = typeof item === 'string' ? item : item.name;
    const type: Exercise['type'] = typeof item === 'string'
      ? (item.match(/treadmill|bike|row|run|walk|elliptical|rope/i) ? 'cardio' : 'strength')
      : item.type ?? 'strength';

    const newExercise: Exercise = {
      name,
      sets: type === 'cardio' ? 1 : 3,
      reps: type === 'cardio' ? 1 : 10,
      durationSeconds: type === 'cardio' ? 600 : null,
      type,
      metricType: type === 'cardio' ? 'cardio' : 'weight_reps',
      equipment: typeof item === 'string' ? newExEquipment : item.equipmentNeeded || newExEquipment,
      restSeconds: type === 'cardio' ? 0 : 90,
      block: 'accessory',
    };
    const newPlan = { ...plan, days: plan.days.map((d, di) => di !== dayIdx ? d : {
      ...d, exercises: [...d.exercises, newExercise]
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
    const a = newDays[idxA];
    const b = newDays[idxB];

    // Swap the whole session — warm-up and cool-down belong to the workout,
    // not to the weekday.
    const carry = (from: WorkoutDay, to: WorkoutDay): WorkoutDay => ({
      ...to,
      focus: from.focus,
      exercises: from.exercises,
      isRest: from.isRest,
      warmup: from.warmup,
      cooldown: from.cooldown,
      sessionType: from.sessionType,
      targetMuscles: from.targetMuscles,
      intensityLabel: from.intensityLabel,
      estimatedMinutes: from.estimatedMinutes,
      coachNote: from.coachNote,
    });

    newDays[idxA] = carry(b, a);
    newDays[idxB] = carry(a, b);

    setPlan({ ...plan, days: newDays });
  }

  function handleExerciseReorder(dayIdx: number, activeId: string, overId: string) {
    if (!plan || activeId === overId) return;

    const day = plan.days[dayIdx];
    const oldIdx = day.exercises.findIndex((e, ei) => exerciseId(e, dayIdx, ei) === activeId);
    const newIdx = day.exercises.findIndex((e, ei) => exerciseId(e, dayIdx, ei) === overId);

    if (oldIdx !== -1 && newIdx !== -1) {
      const newPlan = { ...plan, days: plan.days.map((d, di) => di !== dayIdx ? d : {
        ...d, exercises: arrayMove(d.exercises, oldIdx, newIdx)
      })};
      setPlan(newPlan);
    }
  }

  if (regenerating) return (
    <div className="plan-loading"><div className="plan-spinner" /><h2>REBUILDING <span className="green">YOUR</span> PLAN...</h2><p>Programming sets, rest and recovery</p></div>
  );

  if (!ready) return <div className="loading"><div className="loader" /></div>;
  if (!plan) return <div className="page"><div className="empty"><div className="icon">👻</div><h3>No plan yet</h3><p>Complete onboarding to generate your plan</p></div><Link href="/" className="btn-outline" style={{ margin: '0 20px' }}>← Back Home</Link></div>;

  const todayDayName = dayNames[new Date().getDay()];
  const isTodayCard = (dayName: string): boolean => dayName === todayDayName;

  const meta = plan.meta;
  const phase = meta ? PHASE_META[meta.phase] : null;
  const goalLabel = getGoalProfile(goal).label;

  // Live preview so the day picker explains its own consequence before you commit.
  const previewSplit = draftDays.length >= 2
    ? selectSplit(draftDays.length, normalizeExperience(program?.experience), draftGoal).name
    : '—';

  const focusArea = draftFocus ? FOCUS_AREAS[draftFocus] : null;

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

      {/* Tune training rhythm */}
      {showTune && program && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setShowTune(false)} />
          <div className="bottom-sheet tune-sheet" style={{ zIndex: 300 }}>
            <div style={{ padding: 20 }}>
              <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 20px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Tune your training</h3>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
                These are the inputs the program is built from. Change one and the whole week is
                re-programmed around it.
              </p>

              <TuneRow label="Goal" hint="Drives rep ranges, rest length and how much cardio gets programmed.">
                {GOALS.map(g => (
                  <button key={g.id} className={`tune-opt wide ${draftGoal === g.id ? 'on' : ''}`}
                    onClick={() => setDraftGoal(g.id)}>{g.label}</button>
                ))}
              </TuneRow>

              <TuneRow
                label="Which days you train"
                hint={
                  draftDays.length < 2
                    ? '⚠️ Pick at least two days.'
                    : `${draftDays.length} days a week → ${previewSplit}. Rest days land on everything you leave off.`
                }
              >
                {WEEKDAYS.map((d, i) => (
                  <button
                    key={d}
                    className={`tune-day ${draftDays.includes(i) ? 'on' : ''}`}
                    aria-pressed={draftDays.includes(i)}
                    onClick={() => setDraftDays(
                      draftDays.includes(i) ? draftDays.filter(x => x !== i) : [...draftDays, i].sort((a, b) => a - b),
                    )}
                  >
                    {d}
                  </button>
                ))}
              </TuneRow>

              <TuneRow label="Start time" hint="The ghost holds you to this. It shows on your home screen and turns into a nudge when you are late.">
                <input
                  type="time"
                  className="tune-time"
                  value={draftTime}
                  onChange={e => setDraftTime(e.target.value)}
                />
                {draftTime && (
                  <button className="tune-opt" onClick={() => setDraftTime('')}>Clear</button>
                )}
              </TuneRow>

              <TuneRow label="Session length" hint="Shorter sessions drop accessories first. The main lifts are never cut.">
                {[30, 45, 60, 75].map(m => (
                  <button key={m} className={`tune-opt ${program.sessionMinutes === m ? 'on' : ''}`}
                    onClick={() => setProgram({ ...program, sessionMinutes: m })}>{m}m</button>
                ))}
              </TuneRow>

              <TuneRow label="Experience" hint="Sets your volume, how close to failure you train, and which lifts unlock.">
                {(['beginner', 'intermediate', 'advanced'] as ExperienceLevel[]).map(x => (
                  <button key={x} className={`tune-opt wide ${program.experience === x ? 'on' : ''}`}
                    onClick={() => setProgram({ ...program, experience: x })}>{x}</button>
                ))}
              </TuneRow>

              <TuneRow
                label="Focus area"
                hint={
                  focusArea
                    ? focusArea.rationale
                    : 'Optional. Adds dedicated work for one body part on top of the normal split — the rest of the program is unchanged.'
                }
              >
                <button className={`tune-opt wide ${draftFocus === null ? 'on' : ''}`}
                  onClick={() => setDraftFocus(null)}>None</button>
                {FOCUS_AREA_LIST.map(area => (
                  <button
                    key={area.id}
                    className={`tune-opt wide ${draftFocus === area.id ? 'on' : ''}`}
                    onClick={() => setDraftFocus(area.id)}
                  >
                    {area.emoji} {area.label}
                  </button>
                ))}
              </TuneRow>

              {focusArea && (
                <TuneRow
                  label="How often"
                  hint={FOCUS_FREQUENCY_META[draftFocusFreq].blurb}
                >
                  {(Object.keys(FOCUS_FREQUENCY_META) as FocusFrequency[]).map(f => (
                    <button key={f} className={`tune-opt wide ${draftFocusFreq === f ? 'on' : ''}`}
                      onClick={() => setDraftFocusFreq(f)}>{FOCUS_FREQUENCY_META[f].label}</button>
                  ))}
                </TuneRow>
              )}

              {focusArea && (
                <p className="tune-focus-reality">⚠️ {focusArea.reality}</p>
              )}

              <button
                className="btn-primary"
                style={{ marginTop: 18 }}
                disabled={draftDays.length < 2}
                onClick={applyTune}
              >
                Rebuild my week →
              </button>
              <p className="tune-foot">
                Your logged history and ghosts are kept. Only this week&apos;s programming changes.
              </p>
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
                        width: '100%', display: 'flex', alignItems: 'center',
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

      {/* Program header — what this week is and why */}
      <div className="plan-meta-card">
        <div className="plan-meta-top">
          <div>
            <p className="plan-meta-split">{meta?.splitName ?? 'Your plan'}</p>
            <p className="plan-meta-sub">
              {goalLabel}
              {meta ? ` · ${meta.trainingDays} days × ${meta.sessionMinutes} min` : ''}
              {meta?.focus && meta.focus.sessions > 0
                ? ` · ⭐ ${meta.focus.label} ×${meta.focus.sessions}`
                : ''}
            </p>
          </div>
          {phase && (
            <span className={`plan-phase ${meta!.phase}`}>
              {phase.emoji} {phase.label}
            </span>
          )}
        </div>

        {meta && (
          <p className="plan-meta-week">
            Week {plan.weekNumber} · week {meta.mesocycleWeek} of {meta.mesocycleLength} in this block
            {meta.isDeload ? ' · recovery week' : ''}
          </p>
        )}

        {meta?.coachNotes?.map((note, i) => (
          <p key={i} className="plan-meta-note">{i === 0 ? '🧠 ' : '· '}{note}</p>
        ))}

        {meta?.reentryFromDaysOff ? (
          <p className="plan-meta-note reentry">
            🌱 Rebuilt after {meta.reentryFromDaysOff} days off — this week is deliberately lighter.
          </p>
        ) : null}
      </div>

      <VolumeAudit plan={plan} />

      <div className="plan-actions">
        <button className="btn-outline" onClick={() => editing ? saveEdits() : setEditing(true)} style={{ fontSize: 12, padding: 12 }}>
          {editing ? '💾 Save Changes' : '✏️ Edit Plan'}
        </button>
        <button className="btn-outline" onClick={() => setShowTune(true)} style={{ fontSize: 12, padding: 12 }}>
          🎚️ Tune
        </button>
        <button className="btn-outline" onClick={() => setShowRegen(true)} style={{ fontSize: 12, padding: 12 }}>
          🔄 Rebuild
        </button>
      </div>

      {plan.days.map((day, di) => (
        <div key={di} className={`day-card ${isTodayCard(day.dayName) ? 'today-highlight' : ''}`}>
          <div className="day-card-header">
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 14 }}>{day.dayName} · {day.isRest ? '🛌 Recovery' : day.focus}</h3>
              <span className="day-card-meta">
                {day.isRest
                  ? 'Rest day — mobility only'
                  : `${day.intensityLabel ?? 'Moderate'} · ~${day.estimatedMinutes ?? day.exercises.length * 8} min · ${day.exercises.length} exercises`}
              </span>
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

          {day.coachNote && !editing && <p className="day-coach-note">{day.coachNote}</p>}

          {!day.isRest && !editing && <WarmupBlock steps={day.warmup ?? []} />}

          {!day.isRest && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => {
                if (over) handleExerciseReorder(di, active.id as string, over.id as string);
              }}
            >
              <SortableContext
                items={day.exercises.map((e, ei) => exerciseId(e, di, ei))}
                strategy={verticalListSortingStrategy}
              >
                {day.exercises.map((exercise, ei) => (
                  <SortableExerciseRow
                    key={exerciseId(exercise, di, ei)}
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

          {!editing && <CooldownBlock steps={day.cooldown ?? []} restDay={day.isRest} />}

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
            <h3>Rebuild this week?</h3>
            <p>
              Same goal ({goalLabel}), same equipment ({equipment.length} items), same point in your cycle
              {meta ? ` (week ${meta.mesocycleWeek} of ${meta.mesocycleLength})` : ''}.
              Any edits you made to this week are replaced. Ghost history is preserved.
            </p>
            <div className="dialog-btns">
              <button className="give-up" onClick={() => setShowRegen(false)}>Cancel</button>
              <button className="keep" onClick={() => regenerate()}>Rebuild →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TuneRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="tune-row">
      <span className="tune-label">{label}</span>
      <div className="tune-opts">{children}</div>
      <span className="tune-hint">{hint}</span>
    </div>
  );
}
