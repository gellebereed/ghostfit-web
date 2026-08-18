'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentPlan, getAllSessions, updateStreakWithShield, awardSoulCoins, grantCoins, getWinCount } from '@/lib/db';
import { rollChest, ChestDrop } from '@/lib/chest';
import { calculateTier, getTierLabel } from '@/lib/types';
import { getFocusTheme } from '@/lib/theme';
import { WorkoutDay, GhostSession, Exercise } from '@/lib/types';
import { useAppStore } from '@/store/appStore';
import PostWorkoutRecap from '@/components/PostWorkoutRecap';
import { CooldownCard, WarmupCard } from '@/components/SessionPrep';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Warm-up / cool-down completion is a per-day fact, so it is keyed by date. */
function prepKey(kind: 'warmup' | 'cooldown'): string {
  return `ghostfit_${kind}_${new Date().toDateString()}`;
}

function readPrep(kind: 'warmup' | 'cooldown'): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(prepKey(kind)) === '1';
}

function writePrep(kind: 'warmup' | 'cooldown'): void {
  localStorage.setItem(prepKey(kind), '1');
}

function formatExerciseDetail(exercise: Exercise): string {
  const m = exercise.metricType || (exercise.type === 'cardio' ? 'cardio' : 'weight_reps');

  if (m === 'duration' || m === 'cardio') {
    const secs = exercise.durationSeconds ?? (m === 'cardio' ? 600 : 30);
    const display = secs >= 60
      ? `${Math.floor(secs/60)}m${secs%60 > 0 ? ' '+(secs%60)+'s' : ''}`.trim()
      : `${secs}s`;

    if (m === 'cardio') return `${display} workout`;
    return `${exercise.sets ?? 3} × ${display}`;
  }

  const sets = exercise.sets ?? 3;
  if (exercise.repMin && exercise.repMax && exercise.repMin !== exercise.repMax) {
    return `${sets} × ${exercise.repMin}–${exercise.repMax} reps`;
  }
  return `${sets} × ${exercise.reps ?? 10} reps`;
}

/** The prescription chips shown under an exercise name. */
function prescriptionChips(exercise: Exercise): string[] {
  const chips: string[] = [];
  if (exercise.restSeconds) {
    const r = exercise.restSeconds;
    chips.push(`⏱ ${r >= 60 ? `${Math.round(r / 60 * 10) / 10} min` : `${r}s`} rest`);
  }
  if (exercise.targetRir !== undefined) {
    chips.push(exercise.targetRir === 0 ? '💥 to failure' : `🎯 ${exercise.targetRir} in reserve`);
  }
  if (exercise.supersetGroup) chips.push('🔗 superset');
  return chips;
}

export default function WorkoutPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAppStore();
  const [today, setToday] = useState<WorkoutDay | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [exerciseSessions, setExerciseSessions] = useState<GhostSession[]>([]);
  const [ready, setReady] = useState(false);
  const [warmupDone, setWarmupDone] = useState(false);
  const [cooldownDone, setCooldownDone] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState<{
    workoutResult: 'win' | 'loss';
    totalReps: number;
    totalSets: number;
    exWon: number;
    streak: number;
    totalEx: number;
    duration: number;
    chest: ChestDrop;
    tierLabel: string;
    shieldUsed: boolean;
  } | null>(null);

  useEffect(() => { 
    refreshProfile().then(load); 
  }, [refreshProfile]);

  async function load() {
    try {
      const plan = await getCurrentPlan();
      if (!plan) { router.replace('/'); return; }
      const todayDayName = DAY_NAMES[new Date().getDay()];
      const td = plan.days.find(d => d.dayName === todayDayName) || plan.days[0];
      setToday(td);

      const sessions = await getAllSessions();
      const todayStr = new Date().toDateString();
      const todaySessions = sessions.filter(s => new Date(s.date).toDateString() === todayStr);
      setExerciseSessions(todaySessions);
      
      const completedNames = new Set(todaySessions.map(s => s.exerciseName));
      setCompleted(completedNames);
      setWarmupDone(readPrep('warmup'));
      setCooldownDone(readPrep('cooldown'));
    } catch (err) {
      console.error('Workout load error:', err);
    } finally {
      setReady(true);
    }
  }

  async function triggerRecap(sessions: GhostSession[], td: WorkoutDay) {
    if (!profile) return;

    // Settling is once-per-day. Re-opening a finished workout must replay the
    // same recap, not re-award coins, a chest and another streak increment.
    const settleKey = `ghostfit_recap_${new Date().toDateString()}`;
    const settled = localStorage.getItem(settleKey);
    if (settled) {
      try {
        setRecapData(JSON.parse(settled));
        setShowRecap(true);
        return;
      } catch { /* corrupt entry — fall through and settle again */ }
    }

    const exWon = sessions.filter(s => s.result === 'win').length;
    const totalEx = td.exercises.length;
    const workoutResult = exWon > totalEx / 2 ? 'win' : 'loss';
    
    const { streak, shieldUsed } = await updateStreakWithShield(workoutResult);
    await awardSoulCoins(workoutResult, 0);

    // Variable reward: chest is rolled & banked now (refresh-safe), revealed in the recap
    const chest = rollChest(workoutResult);
    await grantCoins(chest.coins);
    const tierLabel = getTierLabel(calculateTier(await getWinCount()));

    const totalReps = sessions.reduce((a, s) => a + s.totalReps, 0);
    const totalSets = sessions.reduce((a, s) => a + s.setsCompleted, 0);
    const duration = sessions.reduce((a, s) => a + (s.totalDuration || 0), 0) + (totalSets * 90);

    const data: NonNullable<typeof recapData> = {
      workoutResult,
      totalReps,
      totalSets,
      exWon,
      streak,
      totalEx,
      duration,
      chest,
      tierLabel,
      shieldUsed
    };
    try {
      localStorage.setItem(settleKey, JSON.stringify(data));
    } catch { /* quota — worst case the recap settles twice */ }

    setRecapData(data);
    setShowRecap(true);
  }

  if (!ready) return <div className="loading"><div className="loader" /></div>;

  // A rest day is programmed work, not an empty screen. Give it something to do.
  if (!today || today.isRest) return (
    <div className="page" style={{ paddingBottom: 100 }}>
      <div className="empty" style={{ paddingBottom: 8 }}>
        <div className="icon">😴</div>
        <h3>Recovery Day</h3>
        <p>{today?.coachNote ?? 'This is when the training you already did turns into results. Sleep, protein, and an easy walk beat another session today.'}</p>
      </div>
      {today?.cooldown?.length ? (
        <div style={{ padding: '0 20px' }}>
          <CooldownCard
            steps={today.cooldown}
            done={cooldownDone}
            restDay
            onDone={() => { writePrep('cooldown'); setCooldownDone(true); }}
          />
        </div>
      ) : null}
      <Link href="/" className="btn-outline" style={{ margin: '16px 20px 0' }}>← Back Home</Link>
    </div>
  );

  const done = today.exercises.filter(ex => completed.has(ex.name)).length;
  const total = today.exercises.length;
  const allDone = done === total;
  const focusTheme = getFocusTheme(today.focus);

  return (
    <div>
      {showRecap && recapData && (
        <PostWorkoutRecap 
          workoutResult={recapData.workoutResult}
          exerciseSessions={exerciseSessions.map(s => ({
            exerciseName: s.exerciseName,
            metricType: s.totalDuration > 0 ? 'duration' : 'weight_reps',
            totalReps: s.totalReps,
            avgWeight: s.avgWeight,
            setsCompleted: s.setsCompleted,
            totalDuration: s.totalDuration
          }))}
          newStreak={recapData.streak}
          totalReps={recapData.totalReps}
          setsCompleted={recapData.totalSets}
          exercisesWon={recapData.exWon}
          totalExercises={recapData.totalEx}
          durationSeconds={recapData.duration}
          chest={recapData.chest}
          tierLabel={recapData.tierLabel}
          shieldUsed={recapData.shieldUsed}
          onContinue={() => {
            setShowRecap(false);
            router.push('/');
          }}
        />
      )}

      <div className="wk-hero">
        <div
          className="wk-hero-img focus-hero"
          style={{ background: `linear-gradient(135deg, ${focusTheme.from}, ${focusTheme.to})` }}
        >
          <span className="focus-hero-emoji" style={{ fontSize: 96 }}>{focusTheme.emoji}</span>
        </div>
        <div className="wk-hero-gradient" />
        <button className="wk-hero-back" onClick={() => router.push('/')}>←</button>
        <div className={`wk-hero-pill ${allDone ? 'done' : ''}`}>
          {done}/{total} DONE
        </div>
        <div className="wk-hero-info">
          <div className="wk-hero-tags">
            <span className="wk-tag-focus">{today.focus}</span>
            <span className="wk-tag-dot">·</span>
            <span className="wk-tag-day">Day {today.dayNumber}</span>
          </div>
          <h1 className="wk-hero-title">Today&apos;s<br/>Workout</h1>
          <div className="wk-hero-meta">
            <span>⏱ ~{total * 8} min</span>
            <span>🔥 {total} exercises</span>
            <span>💪 {today.focus}</span>
          </div>
        </div>
      </div>

      <div className="wk-progress-track">
        <div className="wk-progress-fill" style={{ width: `${(done / total) * 100}%` }} />
      </div>

      <div className="wk-cards">
        {!allDone && (
          <WarmupCard
            steps={today.warmup ?? []}
            done={warmupDone}
            onDone={() => { writePrep('warmup'); setWarmupDone(true); }}
          />
        )}

        {today.exercises.map((ex, i) => {
          const isDone = completed.has(ex.name);
          const isNext = !isDone && today.exercises.slice(0, i).every(e => completed.has(e.name));

          if (isDone) {
            return (
              <div key={i} className="wk-card wk-card-done">
                <div className="wk-card-check">✓</div>
                <div className="wk-card-body">
                  <p className="wk-card-name done">{ex.name}</p>
                  <p className="wk-card-sub green">Completed ✓</p>
                </div>
              </div>
            );
          }

          if (isNext) {
            return (
              <div key={i} className="wk-card wk-card-active" onClick={() => router.push(`/exercise?idx=${i}`)}>
                <div className="wk-card-glow" />
                <div className="wk-card-inner">
                  <div className="wk-card-pulse-wrap">
                    <div className="wk-card-pulse-ring" />
                    <div className="wk-card-pulse-center"><div className="wk-card-pulse-dot" /></div>
                  </div>
                  <div className="wk-card-body">
                    <p className="wk-card-name active">{ex.name}</p>
                    <div className="wk-card-detail">
                      <span className="wk-card-sets">{formatExerciseDetail(ex)}</span>
                      <span className="wk-card-dot">·</span>
                      <span className="wk-card-time">~{(ex.sets ?? 3) * 2} min</span>
                    </div>
                    {prescriptionChips(ex).length > 0 && (
                      <div className="wk-card-chips">
                        {prescriptionChips(ex).map(chip => (
                          <span key={chip} className="wk-chip">{chip}</span>
                        ))}
                      </div>
                    )}
                    {ex.coachNote && <p className="wk-card-cue">{ex.coachNote}</p>}
                  </div>
                  <button className="wk-start-btn" onClick={(e) => { e.stopPropagation(); router.push(`/exercise?idx=${i}`); }}>
                    Start →
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={i} className="wk-card wk-card-upcoming">
              <div className="wk-card-num">{i + 1}</div>
              <div className="wk-card-body">
                <p className="wk-card-name upcoming">{ex.name}</p>
                <p className="wk-card-sub">{formatExerciseDetail(ex)}</p>
              </div>
              <span className="wk-card-equip">{ex.equipment}</span>
            </div>
          );
        })}
      </div>

      {allDone && !showRecap && (
        <>
          <div style={{ padding: '0 16px 96px' }}>
            <CooldownCard
              steps={today.cooldown ?? []}
              done={cooldownDone}
              onDone={() => { writePrep('cooldown'); setCooldownDone(true); }}
            />
          </div>
          <div className="wk-complete-bar">
            <button className="wk-complete-btn" onClick={() => triggerRecap(exerciseSessions, today)}>
              {cooldownDone || !today.cooldown?.length ? 'Complete Workout 🎉' : 'Finish without stretching'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
