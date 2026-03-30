'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentPlan, getAllSessions, getWinCount, getStreak } from '@/lib/db';
import { WorkoutDay } from '@/lib/types';
import { getAvatarPrefs, getCharEmoji } from '@/lib/avatar';

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

      // Check if all exercises done for recap (Upgrade 7)
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
        backgroundColor: '#141414',
        scale: 2,
        useCORS: true,
        logging: false,
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
  const allDone = done === today.exercises.length;

  return (
    <div>
      {/* Upgrade 7: Post-Workout Recap Overlay */}
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

      <div className="workout-header">
        <button className="hdr-back" onClick={() => router.push('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </button>
        <h1>{today.focus} — Day {today.dayNumber}</h1>
        <span className="workout-progress">{done}/{today.exercises.length} DONE</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(done / today.exercises.length) * 100}%` }} />
      </div>

      {today.exercises.map((ex, i) => {
        const isDone = completed.has(ex.name);
        const isNext = !isDone && today.exercises.slice(0, i).every(e => completed.has(e.name));
        return (
          <div key={i} className={`ex-card ${isDone ? 'completed' : ''} ${isNext ? 'current' : ''}`}
            onClick={() => !isDone && router.push(`/exercise?idx=${i}`)}>
            <div className={`ex-status ${isDone ? 'done' : ''}`}>{isDone ? '✓' : '○'}</div>
            <div className="ex-info">
              <h3>{ex.name} {isDone && '🔥'}</h3>
              <p style={{ color: isNext ? 'var(--accent)' : undefined }}>
                {ex.type === 'cardio' ? `${Math.round((ex.durationSeconds || 300) / 60)} min` : `${ex.sets} sets × ${ex.reps} reps`}
              </p>
            </div>
            {isNext && <button className="ex-start">Start →</button>}
          </div>
        );
      })}

      {allDone && !showRecap && (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <h3 style={{ fontSize: 18, fontWeight: 800 }}>All exercises complete!</h3>
          <button className="btn-outline" onClick={() => setShowRecap(true)} style={{ margin: '12px 0' }}>View Recap 📊</button>
          <Link href="/" className="btn-primary" style={{ marginTop: 8, textDecoration: 'none' }}>Back to Home</Link>
        </div>
      )}
    </div>
  );
}
