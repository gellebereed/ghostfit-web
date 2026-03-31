'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentPlan, getAllSessions, getWinCount, getStreak } from '@/lib/db';
import { WorkoutDay } from '@/lib/types';
import { getAvatarPrefs, getCharEmoji } from '@/lib/avatar';

const WORKOUT_FOCUS_IMAGES: Record<string, string> = {
  'Upper Body': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
  'Lower Body': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Full_Squat/0.jpg',
  'Push':       'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
  'Pull':       'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg',
  'Legs':       'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Full_Squat/0.jpg',
  'Core':       'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Ab_Crunch_Machine/0.jpg',
  'Cardio':     'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Jogging,_Treadmill/0.jpg',
  'Full Body':  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg',
};

export default function WorkoutPage() {
  const router = useRouter();
  const [today, setToday] = useState<WorkoutDay | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState<{ totalReps: number; totalSets: number; exWon: number; streak: number; wins: number; focus: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const recapCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const plan = await getCurrentPlan();
      if (!plan) { router.replace('/'); return; }
      const dayOfWeek = new Date().getDay();
      const dayNum = dayOfWeek === 0 ? 7 : dayOfWeek;
      const td = plan.days.find(d => d.dayNumber === dayNum) || null;
      setToday(td);

      const sessions = await getAllSessions();
      const todayStr = new Date().toDateString();
      const todaySessions = sessions.filter(s => new Date(s.date).toDateString() === todayStr);
      const completedNames = new Set(todaySessions.map(s => s.exerciseName));
      setCompleted(completedNames);

      if (td && !td.isRest && td.exercises.every(ex => completedNames.has(ex.name))) {
        const wins = await getWinCount();
        const streak = await getStreak();
        const totalReps = todaySessions.reduce((a, s) => a + s.totalReps, 0);
        const totalSets = todaySessions.reduce((a, s) => a + s.setsCompleted, 0);
        const exWon = todaySessions.filter(s => s.result === 'win').length;
        setRecapData({ totalReps, totalSets, exWon, streak, wins, focus: td.focus });
        setShowRecap(true);
      }
    } catch (err) {
      console.error('Workout load error:', err);
    } finally {
      setReady(true);
    }
  }

  async function shareRecap() {
    if (!recapCardRef.current) return;
    setSharing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(recapCardRef.current, {
        backgroundColor: '#141414', scale: 2, useCORS: true, logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'ghostfit-battle.png', { type: 'image/png' });
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'GhostFit Battle Result' });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'ghostfit-battle.png'; a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch {}
    setSharing(false);
  }

  const avatar = getAvatarPrefs();
  const yourEmoji = getCharEmoji(avatar.yourCharacterStyle);
  const ghostEmoji = getCharEmoji(avatar.ghostCharacterStyle);

  if (!ready) return <div className="loading"><div className="loader" /></div>;
  if (!today || today.isRest) return (
    <div className="page">
      <div className="empty"><div className="icon">😴</div><h3>Rest Day</h3><p>Come back tomorrow!</p></div>
      <Link href="/" className="btn-outline" style={{ margin: '0 20px' }}>← Back Home</Link>
    </div>
  );

  const done = today.exercises.filter(ex => completed.has(ex.name)).length;
  const total = today.exercises.length;
  const allDone = done === total;
  const heroImg = WORKOUT_FOCUS_IMAGES[today.focus] ?? WORKOUT_FOCUS_IMAGES['Full Body'];

  return (
    <div>
      {/* Post-Workout Recap Overlay */}
      {showRecap && recapData && (
        <div className="recap-overlay">
          <div className="recap-title">BATTLE COMPLETE</div>
          <div className="recap-subtitle">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} · {recapData.focus}</div>

          <div className="recap-card" ref={recapCardRef}>
            <div className="recap-logo">GHOSTFIT 👻</div>
            <div className="recap-battle">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: avatar.yourAuraColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: `0 0 15px ${avatar.yourAuraColor}40` }}>{yourEmoji}</div>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text2)' }}>{avatar.yourCharacterName}</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 900, opacity: 0.5 }}>VS</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: `${avatar.ghostAuraColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, opacity: 0.6 }}>{ghostEmoji}</div>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text2)', opacity: 0.6 }}>{avatar.ghostCharacterName}</span>
              </div>
            </div>
            <div className="recap-result">
              {recapData.exWon > today.exercises.length / 2 ? 'YOU WIN 🔥' : '💀 GHOST WINS'}
            </div>
            <div className="recap-stats">
              <div className="recap-stat"><div className="rs-val">{recapData.totalReps}</div><div className="rs-lbl">Total Reps</div></div>
              <div className="recap-stat"><div className="rs-val">{recapData.totalSets}</div><div className="rs-lbl">Sets Done</div></div>
              <div className="recap-stat"><div className="rs-val">{recapData.exWon}</div><div className="rs-lbl">Exercises Won</div></div>
              <div className="recap-stat"><div className="rs-val">{recapData.streak} 🔥</div><div className="rs-lbl">Win Streak</div></div>
            </div>
            <div className="recap-watermark">ghostfit.app</div>
          </div>

          <div className="recap-buttons">
            <button className="btn-outline" onClick={shareRecap} disabled={sharing} style={{ flex: 1 }}>
              {sharing ? '...' : '📤 Share'}
            </button>
            <button className="btn-primary" onClick={() => { setShowRecap(false); router.push('/'); }} style={{ flex: 1 }}>Continue →</button>
          </div>
        </div>
      )}

      {/* ===== NIKE-INSPIRED HERO SECTION ===== */}
      <div className="wk-hero">
        <img src={heroImg} alt={today.focus} className="wk-hero-img" />
        <div className="wk-hero-gradient" />

        {/* Back button */}
        <button className="wk-hero-back" onClick={() => router.push('/')}>←</button>

        {/* Progress pill */}
        <div className={`wk-hero-pill ${allDone ? 'done' : ''}`}>
          {done}/{total} DONE
        </div>

        {/* Bottom info */}
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

      {/* Progress bar */}
      <div className="wk-progress-track">
        <div className="wk-progress-fill" style={{ width: `${(done / total) * 100}%` }} />
      </div>

      {/* ===== EXERCISE CARDS ===== */}
      <div className="wk-cards">
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
                    <div className="wk-card-pulse-center">
                      <div className="wk-card-pulse-dot" />
                    </div>
                  </div>
                  <div className="wk-card-body">
                    <p className="wk-card-name active">{ex.name}</p>
                    <div className="wk-card-detail">
                      <span className="wk-card-sets">
                        {ex.type === 'cardio' ? `${Math.round((ex.durationSeconds || 300) / 60)} min` : `${ex.sets} sets × ${ex.reps} reps`}
                      </span>
                      <span className="wk-card-dot">·</span>
                      <span className="wk-card-time">~{ex.sets * 2} min</span>
                    </div>
                  </div>
                  <button className="wk-start-btn" onClick={(e) => { e.stopPropagation(); router.push(`/exercise?idx=${i}`); }}>
                    Start →
                  </button>
                </div>
              </div>
            );
          }

          // Upcoming
          return (
            <div key={i} className="wk-card wk-card-upcoming">
              <div className="wk-card-num">{i + 1}</div>
              <div className="wk-card-body">
                <p className="wk-card-name upcoming">{ex.name}</p>
                <p className="wk-card-sub">
                  {ex.type === 'cardio' ? `${Math.round((ex.durationSeconds || 300) / 60)} min` : `${ex.sets} × ${ex.reps} reps`}
                </p>
              </div>
              <span className="wk-card-equip">{ex.equipment}</span>
            </div>
          );
        })}
      </div>

      {/* Complete workout button */}
      {allDone && !showRecap && (
        <div className="wk-complete-bar">
          <button className="wk-complete-btn" onClick={() => setShowRecap(true)}>
            Complete Workout 🎉
          </button>
        </div>
      )}
    </div>
  );
}
