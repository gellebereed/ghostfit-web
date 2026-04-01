'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getProfile, getCurrentPlan, getYesterdayResult, getWinCount, getStreak, getAllSessions } from '@/lib/db';
import { WorkoutPlan, WorkoutDay, calculateTier } from '@/lib/types';
import { getAvatarPrefs, getCharEmoji } from '@/lib/avatar';
import { getGhostTaunt } from '@/lib/taunts';

import { useAppStore } from '@/store/appStore';
import { Avatar } from '@/components/Avatar';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatExerciseDetail(exercise: any): string {
  const m = exercise.metricType || (exercise.type === 'cardio' ? 'cardio' : (exercise.type === 'duration' ? 'duration' : 'weight_reps'));
  
  if (m === 'duration' || m === 'cardio') {
    const secs = exercise.durationSeconds ?? (m === 'cardio' ? 600 : 30);
    const display = secs >= 60 
      ? `${Math.floor(secs/60)}m${secs%60 > 0 ? ' '+(secs%60)+'s' : ''}`.trim()
      : `${secs}s`;
    
    if (m === 'cardio') return display;
    return `${exercise.sets ?? 3} × ${display}`;
  }
  
  const reps = exercise.reps ?? 10;
  const sets = exercise.sets ?? 3;
  if (m === 'bodyweight_reps' || m === 'reps_only') {
    return `${sets} × ${reps}`;
  }
  return `${sets} × ${reps}`;
}

const WORKOUT_FOCUS_IMAGES: Record<string, string> = {
  'Upper Body': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
  'Lower Body': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Full_Squat/0.jpg',
  'Push':       'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
  'Pull':       'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg',
  'Legs':       'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Full_Squat/0.jpg',
  'Core':       'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Ab_Crunch_Machine/0.jpg',
  'Cardio':     'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=400&q=80',
  'Full Body':  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg',
};

export default function HomePage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAppStore();
  const [ready, setReady] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [today, setToday] = useState<WorkoutDay | null>(null);
  const [battleResult, setBattleResult] = useState<'win' | 'loss' | 'none'>('none');
  const [winCount, setWinCount] = useState(0);
  const [streak, setStreakVal] = useState(0);
  const [tier, setTier] = useState(1);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());
  const [taunt, setTaunt] = useState('');

  useEffect(() => {
    let mounted = true;
    const loaderTimer = setTimeout(() => {
      if (mounted) setShowLoader(true);
    }, 100);

    async function init() {
      try {
        await refreshProfile();
        const p = await getCurrentPlan();
        
        // We need to check store after refresh
        const currentProfile = useAppStore.getState().profile;
        if (!currentProfile?.onboardingComplete) { router.replace('/onboarding'); return; }

        const [result, wc, s, sessions] = await Promise.all([
          getYesterdayResult(),
          getWinCount(),
          getStreak(),
          getAllSessions()
        ]);

        setPlan(p);
        let isRest = false;
        if (p) {
          const todayDayName = DAY_NAMES[new Date().getDay()];
          const td = p.days.find(d => d.dayName === todayDayName) || p.days[0];
          setToday(td);
          isRest = td?.isRest || false;
        }

        setBattleResult(result);
        setWinCount(wc);
        setTier(calculateTier(wc));
        setStreakVal(s);

        const todayStr = new Date().toDateString();
        const todaySessions = sessions.filter(sess => new Date(sess.date).toDateString() === todayStr);
        const completedNames = new Set(todaySessions.map(sess => sess.exerciseName));
        setCompleted(completedNames);

        const thisWeek = new Set<number>();
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        sessions.forEach(s => {
          const d = new Date(s.date);
          if (d >= startOfWeek) thisWeek.add(d.getDay());
        });
        setCompletedDays(thisWeek);

        const isFirstDay = sessions.length === 0;
        setTaunt(getGhostTaunt({
          yesterdayResult: result,
          streak: s,
          isRest,
          isFirstDay,
        }));
      } catch (err) {
        console.error('GhostFit init error:', err);
      } finally {
        if (mounted) {
          setReady(true);
          clearTimeout(loaderTimer);
        }
      }
    }
    init();
    return () => { 
      mounted = false; 
      clearTimeout(loaderTimer);
    };
  }, [router, refreshProfile]);

  if (!ready) {
    if (!showLoader) return null;
    return (
      <div className="flex-center" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div className="ghost-loader" style={{ fontSize: 40 }}>👻</div>
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Summoning your ghost...</p>
      </div>
    );
  }

  const isRest = today?.isRest;
  const allDone = today && !isRest && today.exercises.every(ex => completed.has(ex.name));

  return (
    <>
      <header className="hdr">
        <span className="hdr-logo">👻 GHOSTFIT</span>
        {streak > 0 && <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>{streak} day streak 🔥</span>}
      </header>

      <div className="greeting">
        <h1>{getGreeting()}, let&apos;s go 💪</h1>
        <p>Week {plan?.weekNumber || 1} · {today?.focus || 'Rest'} today</p>
      </div>

      <div className={`battle-card ${isRest ? 'rest' : allDone ? 'win' : battleResult === 'win' ? 'win' : battleResult === 'loss' ? 'loss' : 'first'}`}>
        {allDone && <div className="today-chip" style={{ background: 'var(--accent)', color: '#000', top: 12, right: 12 }}>COMPLETED ✓</div>}
        {isRest ? (
          <div className="battle-result">
            <h3>😴 Rest Day</h3>
            <p>Ghost is also resting. Come back tomorrow!</p>
          </div>
        ) : battleResult === 'win' ? (
          <>
            <div className="battle-arena">
              <div className="flex flex-col items-center gap-2">
                <Avatar type="user" size={60} tier={tier} animationState="celebrating" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">{profile?.characterName ?? 'YOU'}</span>
              </div>
              <div className="battle-vs">VS</div>
              <div className="flex flex-col items-center gap-2">
                <Avatar type="ghost" size={60} animationState="losing" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest opacity-60">{profile?.ghostName ?? 'GHOST'}</span>
              </div>
            </div>
            <div className="battle-result">
              <h3>🔥 YOU WON — {streak} WIN STREAK</h3>
              <p>Ghost is shook. Keep the streak going →</p>
            </div>
          </>
        ) : battleResult === 'loss' ? (
          <>
            <div className="battle-arena">
              <div className="flex flex-col items-center gap-2">
                <Avatar type="user" size={60} tier={tier} animationState="losing" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">{profile?.characterName ?? 'YOU'}</span>
              </div>
              <div className="battle-vs">VS</div>
              <div className="flex flex-col items-center gap-2">
                <Avatar type="ghost" size={60} animationState="celebrating" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest opacity-60">{profile?.ghostName ?? 'GHOST'}</span>
              </div>
            </div>
            <div className="battle-result">
              <h3>💀 GHOST WINS</h3>
              <p>Yesterday&apos;s you beat today&apos;s you. Rematch time.</p>
            </div>
          </>
        ) : (
          <div className="battle-result">
            <div style={{ fontSize: 48, marginBottom: 12 }}>👻</div>
            <h3>Your ghost is waiting to be created</h3>
            <p>Complete today&apos;s workout to summon it</p>
          </div>
        )}

        {taunt && <div className="taunt-bubble">{taunt}</div>}

        {!isRest && (
          <Link href="/workout" className="btn-primary" style={{ marginTop: 12, textDecoration: 'none' }}>
            {allDone ? 'REVISIT WORKOUT' : battleResult === 'loss' ? 'GET REVENGE →' : battleResult === 'win' ? 'START TODAY\'S BATTLE' : 'START WORKOUT'}
          </Link>
        )}
      </div>

      {today && !today.isRest && (
        <div className="today-hero-card">
          <div className="today-hero-img-wrap">
            {WORKOUT_FOCUS_IMAGES[today.focus] && (
              <img
                src={WORKOUT_FOCUS_IMAGES[today.focus]}
                alt={today.focus}
                className="today-hero-img"
              />
            )}
            <div className="today-hero-gradient" />
            <div className="today-hero-chip">TODAY</div>
            <div className="today-hero-meta">
              <h2 className="today-hero-focus">{today.focus}</h2>
              <div className="today-hero-stats">
                <span>🏋️ {today.exercises.length} exercises</span>
                <span>⏱ ~{today.exercises.length * 8} mins</span>
              </div>
            </div>
          </div>

          <div className="today-hero-body">
            {today.exercises.slice(0, 3).map((ex, i) => (
              <div className="today-hero-ex" key={ex.name} style={{ opacity: completed.has(ex.name) ? 0.55 : 1 }}>
                <div className="today-hero-num">
                  {completed.has(ex.name) ? '✓' : i + 1}
                </div>
                <span className="today-hero-name">{ex.name}</span>
                <span className="today-hero-badge">
                  {formatExerciseDetail(ex)}
                </span>
              </div>
            ))}
            {today.exercises.length > 3 && (
              <p className="today-hero-more">+{today.exercises.length - 3} more exercises</p>
            )}
            <Link
              href="/workout"
              className="today-hero-start"
              style={{ textDecoration: 'none' }}
            >
              {allDone ? 'Revisit Workout ✓' : 'Start Workout 🚀'}
            </Link>
          </div>
        </div>
      )}

      <div className="week-row">
        {DAYS.map((d, i) => {
          const isToday = new Date().getDay() === i;
          const isDone = completedDays.has(i);
          const isSunday = i === 0;
          return (
            <div className="day-chip" key={d}>
              <div className={`day-dot ${isToday ? 'today' : ''} ${isDone ? 'done' : ''} ${isSunday && !isDone ? 'rest' : ''}`}>
                {isDone ? '✓' : isSunday ? '😴' : ''}
              </div>
              {d}
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Link href="/plan" style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none', letterSpacing: 0.5 }}>
          My Plan ✏️
        </Link>
      </div>

      <nav className="nav">
        <Link href="/" className="nav-item active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          HOME
        </Link>
        <Link href="/history" className="nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          HISTORY
        </Link>
        <Link href="/profile" className="nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          PROFILE
        </Link>
      </nav>
    </>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

