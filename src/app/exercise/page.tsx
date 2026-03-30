'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getCurrentPlan, getGhostForExercise, saveGhostSession, getWinCount, getAllSessions, getCachedExercise, cacheExercise, getStreak, getAllTimeBest, updateCachedVideoId } from '@/lib/db';
import { Exercise, GhostSession, ExerciseInfo, calculateTier } from '@/lib/types';
import { getAvatarPrefs, getCharEmoji } from '@/lib/avatar';
import { checkMilestones, MilestoneEvent } from '@/lib/milestones';
import { playSetComplete, playGhostBeaten, playGiveUp, playMilestone, hapticSetComplete, hapticGhostBeaten, hapticGiveUp, hapticMilestone } from '@/lib/sound';
import YouTubePlayer from '@/components/YouTubePlayer';

function ExerciseContent() {
  const router = useRouter();
  const params = useSearchParams();
  const idx = parseInt(params.get('idx') || '0');

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [ghost, setGhost] = useState<GhostSession | null>(null);
  const [tier, setTier] = useState(1);

  // Strength state
  const [currentSet, setCurrentSet] = useState(1);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [totalReps, setTotalReps] = useState(0);
  const [weights, setWeights] = useState<number[]>([]);
  const [setsCompleted, setSetsCompleted] = useState(0);

  // Cardio state
  const [seconds, setSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // UI state
  const [showGiveUp, setShowGiveUp] = useState(false);
  const [result, setResult] = useState<'win' | 'loss' | 'first' | null>(null);
  const [arenaShake, setArenaShake] = useState(false);
  const [flash, setFlash] = useState(false);

  // Upgrade 2: GIF state
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [gifLoading, setGifLoading] = useState(true);
  const [showAllInstr, setShowAllInstr] = useState(false);

  // YouTube tutorial state
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);

  // Upgrade 8: Milestone
  const [milestone, setMilestone] = useState<MilestoneEvent | null>(null);
  const [totalWinsBefore, setTotalWinsBefore] = useState(0);

  useEffect(() => {
    load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  async function load() {
    try {
      const plan = await getCurrentPlan();
      if (!plan) { router.replace('/'); return; }
      const dayOfWeek = new Date().getDay();
      const dayNum = dayOfWeek === 0 ? 7 : dayOfWeek;
      const td = plan.days.find(d => d.dayNumber === dayNum);
      if (!td || idx >= td.exercises.length) { router.replace('/workout'); return; }
      const ex = td.exercises[idx];
      setExercise(ex);

      const g = await getGhostForExercise(ex.name);
      setGhost(g);
      const wc = await getWinCount();
      setTotalWinsBefore(wc);
      setTier(calculateTier(wc));

      // Upgrade 2: Fetch exercise GIF
      loadExerciseGif(ex.name);
    } catch (err) {
      console.error('Exercise load error:', err);
      router.replace('/workout');
    }
  }

  async function loadExerciseGif(name: string) {
    setGifLoading(true);
    setVideoLoading(true);
    try {
      // Check cache first
      const cached = await getCachedExercise(name);
      if (cached) {
        setGifUrl(cached.gifUrl || null);
        setInstructions(cached.instructions);
        setGifLoading(false);
        // Check if video ID is already cached
        if (cached.youtubeVideoId) {
          setVideoId(cached.youtubeVideoId);
          setVideoLoading(false);
          return;
        }
        // GIF cached but no video yet — fetch video in background
        await fetchAndCacheVideo(name);
        return;
      }
      // Fetch from ExerciseDB API (free)
      const searchName = name.toLowerCase().replace(/[^a-z\s]/g, '');
      const res = await fetch(`https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(searchName)}?limit=1`, {
        headers: { 'X-RapidAPI-Key': 'demo', 'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          const info: ExerciseInfo = {
            name, gifUrl: data[0].gifUrl || '', instructions: data[0].instructions || [],
            bodyPart: data[0].bodyPart || '',
          };
          setGifUrl(info.gifUrl);
          setInstructions(info.instructions);
          await cacheExercise(info);
        }
      }
    } catch {}
    setGifLoading(false);
    // Fetch YouTube video regardless of GIF result
    await fetchAndCacheVideo(name);
  }

  async function fetchAndCacheVideo(name: string) {
    setVideoLoading(true);
    try {
      const res = await fetch(`/api/youtube-search?exercise=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.videoId) {
          setVideoId(data.videoId);
          await updateCachedVideoId(name, data.videoId);
        }
      }
    } catch {}
    setVideoLoading(false);
  }

  // Strength: complete a set
  function completeSet() {
    const r = parseInt(reps) || 0;
    const w = parseFloat(weight) || 0;
    setTotalReps(prev => prev + r);
    setWeights(prev => [...prev, w]);
    setSetsCompleted(prev => prev + 1);
    playSetComplete();
    hapticSetComplete();

    if (ghost && totalReps + r > ghost.totalReps) {
      setFlash(true);
      setTimeout(() => setFlash(false), 500);
    } else if (ghost && totalReps + r === ghost.totalReps) {
      setArenaShake(true);
      setTimeout(() => setArenaShake(false), 300);
    }

    if (currentSet >= (exercise?.sets || 3)) {
      finishExercise(totalReps + r, setsCompleted + 1, w);
    } else {
      setCurrentSet(prev => prev + 1);
      setReps('');
    }
  }

  // Cardio: timer
  function startTimer() {
    setTimerRunning(true);
    timerRef.current = setInterval(() => setSeconds(prev => prev + 1), 1000);
  }
  function pauseTimer() {
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }
  function stopTimer() {
    pauseTimer();
    finishExercise(0, 0, 0, seconds);
  }

  const finishExercise = useCallback(async (reps: number, sets: number, avgW: number, duration?: number) => {
    if (!exercise) return;
    const isCardio = exercise.type === 'cardio';
    const ghostTarget = ghost ? (isCardio ? ghost.totalDuration : ghost.totalReps) : 0;
    const myScore = isCardio ? (duration || seconds) : reps;
    const won = ghost ? myScore > ghostTarget : false;
    const res: 'win' | 'loss' | 'first' = ghost ? (won ? 'win' : 'loss') : 'first';

    // Check personal record (before saving this session)
    const prevBest = await getAllTimeBest(exercise.name);
    const hasPrevBest = isCardio ? prevBest.totalDuration > 0 : prevBest.totalReps > 0;
    const isNewPR = hasPrevBest && (isCardio
      ? (duration || seconds) > prevBest.totalDuration
      : reps > prevBest.totalReps);

    // Capture streak before saving (for streak-broken detection)
    const streakBefore = await getStreak();

    const session: GhostSession = {
      id: crypto.randomUUID(), exerciseName: exercise.name, date: Date.now(),
      totalReps: reps, avgWeight: avgW || (weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0),
      totalDuration: duration || seconds, setsCompleted: sets,
      result: res === 'first' ? 'win' : res, characterTier: tier,
    };
    await saveGhostSession(session);

    if (won) { playGhostBeaten(); hapticGhostBeaten(); }

    // Check milestones (Upgrade 8)
    const allSessions = await getAllSessions();
    const newWins = allSessions.filter(s => s.result === 'win').length;
    const newTier = calculateTier(newWins);
    const streakAfter = await getStreak();
    const streakBroken = streakBefore >= 2 && streakAfter === 0 && res === 'loss';

    const ms = checkMilestones({
      totalWins: newWins, totalSessions: allSessions.length, streak: streakAfter,
      justWon: won || res === 'first', oldTier: tier, newTier,
      personalRecord: isNewPR ? {
        exerciseName: exercise.name,
        oldBest: isCardio ? prevBest.totalDuration : prevBest.totalReps,
        newBest: isCardio ? (duration || seconds) : reps,
        isCardio,
      } : undefined,
      streakBroken,
    });
    if (ms) {
      playMilestone(); hapticMilestone();
      setMilestone(ms);
      // Auto dismiss after 2.5s
      setTimeout(() => setMilestone(null), 2500);
    }

    setResult(res);
  }, [exercise, ghost, seconds, tier, weights]);

  // Give up
  async function handleGiveUp() {
    if (!exercise) return;
    const session: GhostSession = {
      id: crypto.randomUUID(), exerciseName: exercise.name, date: Date.now(),
      totalReps, avgWeight: weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0,
      totalDuration: seconds, setsCompleted, result: 'loss', characterTier: tier,
    };
    await saveGhostSession(session);
    playGiveUp(); hapticGiveUp();
    setResult('loss');
    setShowGiveUp(false);
  }

  if (!exercise) return <div className="loading"><div className="loader" /></div>;
  const isCardio = exercise.type === 'cardio';
  const ghostTarget = ghost ? (isCardio ? ghost.totalDuration : ghost.totalReps) : 0;
  const myScore = isCardio ? seconds : totalReps;
  const ahead = ghost ? myScore > ghostTarget : false;
  const tied = ghost ? myScore === ghostTarget : false;

  const avatar = getAvatarPrefs();
  const yourEmoji = getCharEmoji(avatar.yourCharacterStyle);
  const ghostEmoji = getCharEmoji(avatar.ghostCharacterStyle);
  const instrToShow = showAllInstr ? instructions : instructions.slice(0, 2);

  return (
    <>
      {/* Milestone Overlay - Upgrade 8 */}
      {milestone && (
        <div className="milestone-overlay" onClick={() => setMilestone(null)}>
          <div className="milestone-icon">{milestone.icon}</div>
          <h2>{milestone.title}</h2>
          <p>{milestone.message}</p>
          <div className="tap-hint">TAP TO CONTINUE</div>
        </div>
      )}

      {/* Result overlays */}
      {result && !milestone && (
        <div className={`result-overlay ${result === 'loss' ? 'loss-overlay' : 'win-overlay'}`}>
          <div className="result-icon">{result === 'win' ? '🔥' : result === 'first' ? '👻' : '💀'}</div>
          <h2>{result === 'win' ? 'YOU BEAT YOUR GHOST' : result === 'first' ? 'GHOST DATA SAVED' : 'GHOST WINS TODAY'}</h2>
          <p>{result === 'win' ? `+${myScore - ghostTarget} ${isCardio ? 'seconds' : 'reps'} more than last time!`
            : result === 'first' ? 'Beat this next time you do this exercise.'
            : "Tomorrow's you will remember this."}</p>
          <button className="btn-primary" onClick={() => router.push('/workout')}>Continue →</button>
        </div>
      )}

      {/* Give up dialog */}
      {showGiveUp && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>👻 If you stop now, ghost wins this round.</h3>
            <p>Are you sure you want to give up?</p>
            <div className="dialog-btns">
              <button className="keep" onClick={() => setShowGiveUp(false)}>Keep Fighting</button>
              <button className="give-up" onClick={handleGiveUp}>Give Up</button>
            </div>
          </div>
        </div>
      )}

      <div className="battle-page">
        <header className="hdr">
          <button className="hdr-back" onClick={() => router.push('/workout')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>BATTLE</span>
          <div style={{ width: 20 }} />
        </header>

        {/* Arena with avatar colors */}
        <div className={`arena ${arenaShake ? 'shake' : ''}`}>
          {flash && <div className="arena-flash" />}
          <div className="arena-bg" />
          <div className="arena-chars">
            <div className="arena-char">
              <div className="arena-counter green">{isCardio ? formatTime(seconds) : totalReps}</div>
              <div className="ghost-body you" style={{ width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: avatar.yourAuraColor, boxShadow: `0 0 15px ${avatar.yourAuraColor}40`, animation: ahead ? 'celebrate 0.5s ease infinite alternate' : undefined, overflow: 'hidden' }}>
                {avatar.yourUsesPhoto && avatar.yourPhotoUrl
                  ? <img src={avatar.yourPhotoUrl} alt="You" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : yourEmoji}
              </div>
              <span className="ghost-label">{avatar.yourCharacterName}</span>
            </div>

            <div className="battle-vs">VS</div>

            <div className="arena-char" style={{ position: 'relative' }}>
              {ghost && !ahead && !tied && <div className="arena-speech" style={{ right: -10 }}>Beat that 💪</div>}
              {ghost && tied && <div className="arena-speech" style={{ right: -10 }}>Wait—</div>}
              {ghost && ahead && <div className="arena-speech" style={{ right: -10 }}>Oh no—</div>}
              <div className="arena-counter gray">{ghost ? (isCardio ? formatTime(ghost.totalDuration) : ghost.totalReps) : '—'}</div>
              <div className="ghost-body ghost" style={{ width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, background: `${avatar.ghostAuraColor}30`, opacity: ahead ? 0.3 : 0.7, animation: !ahead && ghost ? 'taunt 1.5s ease infinite' : undefined, overflow: 'hidden' }}>
                {avatar.ghostUsesPhoto && avatar.ghostPhotoUrl
                  ? <img src={avatar.ghostPhotoUrl} alt="Ghost" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(20%) blur(0.3px)' }} />
                  : ghostEmoji}
              </div>
              <span className="ghost-label" style={{ opacity: 0.6 }}>{avatar.ghostCharacterName}</span>
            </div>
          </div>
        </div>

        {/* Exercise info */}
        <div className="ex-detail">
          <h2>{exercise.name}</h2>
          <div className="ex-equip-chip">{exercise.equipment}</div>
        </div>

        {/* Tutorial Video Section */}
        <div className="gif-section">
          <div className="gif-label tutorial-label">TUTORIAL</div>
          {videoLoading ? (
            <div className="yt-player-wrap">
              <div className="gif-shimmer" style={{ height: '100%' }} />
            </div>
          ) : videoId ? (
            <YouTubePlayer videoId={videoId} />
          ) : (
            // Fallback: show GIF if video unavailable
            <div className="gif-player">
              {gifLoading ? (
                <div className="gif-shimmer" />
              ) : gifUrl ? (
                <img src={gifUrl} alt={exercise.name} />
              ) : (
                <div className="gif-placeholder" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span>🏋️</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Video unavailable</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        {instructions.length > 0 && (
          <div className="instructions-list">
            {instrToShow.map((step, i) => (
              <div className="instr-step" key={i}>
                <div className="instr-num">{i + 1}</div>
                <span>{step}</span>
              </div>
            ))}
            {instructions.length > 2 && (
              <button className="show-more-btn" onClick={() => setShowAllInstr(!showAllInstr)}>
                {showAllInstr ? 'Show less ↑' : `Show all ${instructions.length} steps ↓`}
              </button>
            )}
          </div>
        )}

        {/* Logger */}
        <div className="logger">
          {isCardio ? (
            <>
              <div className="timer-display">{formatTime(seconds)}</div>
              <div className="timer-controls">
                {!timerRunning ? (
                  <button className="timer-btn start" onClick={startTimer}>▶ Start</button>
                ) : (
                  <button className="timer-btn pause" onClick={pauseTimer}>⏸ Pause</button>
                )}
                <button className="timer-btn stop" onClick={stopTimer}>⏹ Finish</button>
              </div>
            </>
          ) : (
            <>
              <div className="set-counter">Set {currentSet} of {exercise.sets}</div>
              <div className="logger-inputs">
                <div className="logger-field">
                  <label>Weight (kg)</label>
                  <input type="number" inputMode="decimal" placeholder="0" value={weight} onChange={e => setWeight(e.target.value)} />
                </div>
                <div className="logger-field">
                  <label>Reps</label>
                  <input type="number" inputMode="numeric" placeholder="0" value={reps} onChange={e => setReps(e.target.value)} />
                </div>
              </div>
              <button className="btn-primary" onClick={completeSet} disabled={!reps}>
                Complete Set ✓
              </button>
            </>
          )}
        </div>

        <div style={{ textAlign: 'right', padding: '8px 20px' }}>
          <button className="btn-ghost" onClick={() => setShowGiveUp(true)}>End Early</button>
        </div>
      </div>
    </>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function ExercisePage() {
  return (
    <Suspense fallback={<div className="loading"><div className="loader" /></div>}>
      <ExerciseContent />
    </Suspense>
  );
}
