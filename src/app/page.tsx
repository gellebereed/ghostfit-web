'use client';
import BottomNav from '@/components/BottomNav';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getProfile, getCurrentPlan, getYesterdayResult, getWinCount, getStreak, getAllSessions } from '@/lib/db';
import { WorkoutPlan, WorkoutDay, Exercise, calculateTier } from '@/lib/types';
import { getAvatarPrefs, getCharEmoji } from '@/lib/avatar';
import { getGhostTaunt } from '@/lib/taunts';
import { getFocusTheme } from '@/lib/theme';
import { getNutritionProfile, getCurrentMealPlan, getTodayLogs } from '@/lib/nutrition';
import { getQuests, selectTodayTasks } from '@/lib/quests';
import { getHabits } from '@/lib/habits';
import { getActiveChallengeCount } from '@/lib/social';

import { useAppStore } from '@/store/appStore';
import { Avatar } from '@/components/Avatar';
import WelcomeOverlay from '@/components/WelcomeOverlay';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatExerciseDetail(exercise: Exercise): string {
  const m = exercise.metricType || (exercise.type === 'cardio' ? 'cardio' : 'weight_reps');
  
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
  const [daysAway, setDaysAway] = useState<number | null>(null);
  const [freshStart, setFreshStart] = useState(false);
  const [dash, setDash] = useState<{
    fuel: { has: boolean; kcal: number; target: number } | null;
    quests: { dueToday: number; active: number } | null;
    rhythm: { done: number; total: number } | null;
    challenges: number;
  }>({ fuel: null, quests: null, rhythm: null, challenges: 0 });

  useEffect(() => {
    let mounted = true;
    const loaderTimer = setTimeout(() => {
      if (mounted) setShowLoader(true);
    }, 100);

    async function init() {
      try {
        await refreshProfile();
        const currentProfile = useAppStore.getState().profile;
        if (!currentProfile?.onboardingComplete) {
          router.replace('/onboarding');
          return;
        }
        const p = await getCurrentPlan();

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

        // Ghost power: how long has the ghost been feeding on your absence?
        let away: number | null = null;
        if (sessions.length > 0) {
          const latest = Math.max(...sessions.map(sess => sess.date));
          away = Math.floor((Date.now() - latest) / 86400000);
        }
        setDaysAway(away);

        // Fresh-start effect: Monday / 1st of month with no streak = clean slate framing
        const now2 = new Date();
        setFreshStart(
          sessions.length > 0 && s === 0 &&
          (now2.getDay() === 1 || now2.getDate() === 1)
        );

        setTaunt(getGhostTaunt({
          yesterdayResult: result,
          streak: s,
          isRest,
          isFirstDay,
          daysAway: away,
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

  // Control-center summaries — loaded separately so they never block the battle view
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [np, mealPlan, logs, q, habits, chal] = await Promise.all([
          getNutritionProfile(),
          getCurrentMealPlan(),
          getTodayLogs(),
          getQuests(),
          getHabits(),
          getActiveChallengeCount(),
        ]);
        if (!live) return;
        const kcal = logs.filter(l => l.status === 'ate').reduce((a, l) => a + l.kcal, 0);
        const todayTasks = selectTodayTasks(q.quests, q.inbox);
        setDash({
          fuel: np?.onboardingComplete && mealPlan
            ? { has: true, kcal, target: np.targetKcal }
            : { has: false, kcal: 0, target: 0 },
          quests: { dueToday: todayTasks.length, active: q.quests.filter(x => x.status === 'active').length },
          rhythm: { done: habits.filter(h => h.doneToday).length, total: habits.length },
          challenges: chal,
        });
      } catch (e) {
        console.warn('Dashboard summary load failed:', e);
      }
    })();
    return () => { live = false; };
  }, []);

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
  // Ghost feeds after 2+ days away (capped visual power at 7 days)
  const ghostFed = !isRest && !allDone && daysAway !== null && daysAway >= 2;
  const ghostPower = ghostFed ? Math.min(daysAway!, 7) : 0;

  return (
    <>
      <WelcomeOverlay
        profile={profile}
        streak={streak}
        tier={tier}
        soulCoins={profile?.soulCoins ?? 0}
        battleResult={battleResult}
      />
      <header className="hdr">
        <span className="hdr-logo">👻 GHOSTFIT</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(profile?.streakShields ?? 0) > 0 && (
            <span style={{ fontSize: 13, fontWeight: 700 }} title="Streak Shields">🛡️×{profile?.streakShields}</span>
          )}
          {streak > 0 && <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>{streak} day streak 🔥</span>}
        </span>
      </header>

      <div className="greeting">
        <h1>{getGreeting()}, let&apos;s go 💪</h1>
        <p>Week {plan?.weekNumber || 1} · {today?.focus || 'Rest'} today</p>
        {profile?.commitmentTime && !isRest && !allDone && (
          <p className="commitment-line">
            {isPastTime(profile.commitmentTime)
              ? `⏰ It's past ${profile.commitmentTime}. The ghost noticed you're late.`
              : `⏰ You told the ghost you'd show up at ${profile.commitmentTime}. It remembers.`}
          </p>
        )}
      </div>

      {freshStart && (
        <div className="fresh-start">
          🌅 <strong>Fresh start.</strong> Last week is dead — the ghost isn&apos;t. The comeback begins today.
        </div>
      )}

      <div className={`battle-card ${isRest ? 'rest' : allDone ? 'win' : ghostFed ? 'loss' : battleResult === 'win' ? 'win' : battleResult === 'loss' ? 'loss' : 'first'}`}>
        {allDone && <div className="today-chip" style={{ background: 'var(--accent)', color: '#000', top: 12, right: 12 }}>COMPLETED ✓</div>}
        {!isRest && !allDone && ghostFed ? (
          <>
            <div className="battle-arena">
              <div className="flex flex-col items-center gap-2" style={{ opacity: 0.55, filter: 'saturate(0.6)' }}>
                <Avatar type="user" size={52} tier={tier} animationState="losing" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">{profile?.characterName ?? 'YOU'}</span>
              </div>
              <div className="battle-vs">VS</div>
              <div className="flex flex-col items-center gap-2 ghost-fed" style={{ ['--ghost-scale' as string]: String(1 + ghostPower * 0.06) }}>
                <Avatar type="ghost" size={60 + ghostPower * 4} animationState="celebrating" />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--loss-red)' }}>{profile?.ghostName ?? 'GHOST'}</span>
              </div>
            </div>
            <div className="battle-result">
              <h3 style={{ color: 'var(--loss-red)' }}>👿 THE GHOST HAS FED</h3>
              <p>{daysAway} days without training. Every day you skip, it grows. Take your power back.</p>
            </div>
          </>
        ) : isRest ? (
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
            {allDone ? 'REVISIT WORKOUT' : ghostFed ? 'STARVE THE GHOST →' : battleResult === 'loss' ? 'GET REVENGE →' : battleResult === 'win' ? 'START TODAY\'S BATTLE' : 'START WORKOUT'}
          </Link>
        )}
      </div>

      {today && !today.isRest && (
        <div className="today-hero-card">
          <div className="today-hero-img-wrap">
            <div
              className="today-hero-img focus-hero"
              style={{ background: `linear-gradient(135deg, ${getFocusTheme(today.focus).from}, ${getFocusTheme(today.focus).to})` }}
            >
              <span className="focus-hero-emoji">{getFocusTheme(today.focus).emoji}</span>
            </div>
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

      <p className="dash-section-title">Your day at a glance</p>
      <div className="dash-grid">
        {/* Fuel */}
        <Link href="/nutrition" className="dash-tile">
          <div className="dash-tile-head">
            <span className="dash-tile-emoji">🥗</span>
            <span className="dash-tile-name">Fuel</span>
            <span className="dash-tile-arrow">→</span>
          </div>
          {dash.fuel?.has ? (
            <>
              <span className="dash-tile-stat">{dash.fuel.kcal}<span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}> / {dash.fuel.target} kcal</span></span>
              <div className="dash-mini-track">
                <div className="dash-mini-fill" style={{ width: `${dash.fuel.target ? Math.min(100, (dash.fuel.kcal / dash.fuel.target) * 100) : 0}%`, background: 'var(--accent)' }} />
              </div>
            </>
          ) : (
            <span className="dash-tile-sub">Set up your meal plan — country-aware, built from foods you love.</span>
          )}
        </Link>

        {/* Quests */}
        <Link href="/quests" className="dash-tile">
          <div className="dash-tile-head">
            <span className="dash-tile-emoji">🎯</span>
            <span className="dash-tile-name">Quests</span>
            <span className="dash-tile-arrow">→</span>
          </div>
          {dash.quests ? (
            <>
              <span className="dash-tile-stat">{dash.quests.dueToday}<span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}> due today</span></span>
              <span className="dash-tile-sub">{dash.quests.active} active {dash.quests.active === 1 ? 'quest' : 'quests'} in motion</span>
            </>
          ) : <span className="dash-tile-sub">Loading…</span>}
        </Link>

        {/* Daily Rhythm */}
        <Link href="/quests" className="dash-tile">
          <div className="dash-tile-head">
            <span className="dash-tile-emoji">☪️</span>
            <span className="dash-tile-name">Daily Rhythm</span>
            <span className="dash-tile-arrow">→</span>
          </div>
          {dash.rhythm && dash.rhythm.total > 0 ? (
            <>
              <span className="dash-tile-stat">{dash.rhythm.done}<span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}> / {dash.rhythm.total} today</span></span>
              <div className="dash-mini-track">
                <div className="dash-mini-fill" style={{ width: `${(dash.rhythm.done / dash.rhythm.total) * 100}%`, background: '#FFD700' }} />
              </div>
            </>
          ) : (
            <span className="dash-tile-sub">Anchor your day — deen &amp; body practices with streaks.</span>
          )}
        </Link>

        {/* Arena */}
        <Link href="/arena" className="dash-tile">
          <div className="dash-tile-head">
            <span className="dash-tile-emoji">⚔️</span>
            <span className="dash-tile-name">Arena</span>
            <span className="dash-tile-arrow">→</span>
          </div>
          {dash.challenges > 0 ? (
            <>
              <span className="dash-tile-stat">{dash.challenges}<span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}> live {dash.challenges === 1 ? 'battle' : 'battles'}</span></span>
              <span className="dash-tile-sub">Keep the pressure on. Every rep counts.</span>
            </>
          ) : (
            <span className="dash-tile-sub">Challenge a friend — or your own best self.</span>
          )}
        </Link>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Link href="/plan" style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none', letterSpacing: 0.5 }}>
          My Plan ✏️
        </Link>
      </div>

      <BottomNav active="home" />
    </>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function isPastTime(hhmm: string): boolean {
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h)) return false;
  const now = new Date();
  return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= (m || 0));
}
