'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getCurrentPlan, getGhostForExercise, saveGhostSession, getWinCount, getAllSessions, getCachedExercise, cacheExercise, getStreak, getAllTimeBest, updateCachedVideoId, getProfile } from '@/lib/db';
import { Exercise, GhostSession, ExerciseInfo, calculateTier } from '@/lib/types';
import { getAvatarPrefs, getCharEmoji } from '@/lib/avatar';
import { checkMilestones, MilestoneEvent } from '@/lib/milestones';
import { playSetComplete, playGhostBeaten, playGiveUp, playMilestone, hapticSetComplete, hapticGhostBeaten, hapticGiveUp, hapticMilestone } from '@/lib/sound';

function getInitiationBenchmark(
  exerciseName: string,
  exerciseType: 'strength' | 'cardio',
  goal: string
): { reps: number; weight: number; duration: number } {
  const benchmarks: Record<string, any> = {
    'Get Shredded': { strength: { reps: 12, weight: 15, duration: 0 }, cardio: { reps: 0, weight: 0, duration: 20 * 60 } },
    'Build Muscle': { strength: { reps: 10, weight: 20, duration: 0 }, cardio: { reps: 0, weight: 0, duration: 15 * 60 } },
    'Get Stronger': { strength: { reps: 6, weight: 30, duration: 0 }, cardio: { reps: 0, weight: 0, duration: 10 * 60 } },
    'Improve Fitness': { strength: { reps: 15, weight: 10, duration: 0 }, cardio: { reps: 0, weight: 0, duration: 25 * 60 } }
  };
  const base = benchmarks[goal]?.[exerciseType] ?? benchmarks['Get Shredded'][exerciseType];
  return { reps: base.reps * 3, weight: base.weight, duration: base.duration };
}

function YouTubeEmbed({ videoId }: { videoId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-[#141414]" style={{ aspectRatio: '16/9' }}>
      {!loaded && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-[#1F1F1F] flex items-center justify-center">
            <span className="text-gray-600 text-xl">▶</span>
          </div>
          <p className="text-gray-700 text-xs uppercase tracking-widest font-bold">
            Loading tutorial...
          </p>
        </div>
      )}
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
        className={`w-full h-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="text-gray-600 text-2xl">📵</span>
          <p className="text-gray-600 text-xs">Video unavailable</p>
        </div>
      )}
    </div>
  );
}

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
  const [justScored, setJustScored] = useState(false);

  // Bug Fix 1: Guard against double-taps
  const processingRef = useRef(false);

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

      let g = await getGhostForExercise(ex.name);
      if (!g) {
        const profile = await getProfile();
        const goal = profile?.goal || 'Get Shredded';
        const isCardioEx = ex.name.toLowerCase().includes('run') || ex.name.toLowerCase().includes('cycle') || ex.name.toLowerCase().includes('cardio');
        const benchmark = getInitiationBenchmark(ex.name, isCardioEx ? 'cardio' : 'strength', goal);
        g = {
          totalReps: benchmark.reps,
          avgWeight: benchmark.weight,
          totalDuration: benchmark.duration,
          isInitiation: true
        } as any;
      }
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
        if (cached.youtubeVideoId) {
          setVideoId(cached.youtubeVideoId);
          setVideoLoading(false);
          return;
        }
        await fetchAndCacheVideo(name);
        return;
      }
      // Fetch from server-side ExerciseDB API route
      const res = await fetch(`/api/exercise-gif?name=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.gifUrl) {
          const info: ExerciseInfo = {
            name, gifUrl: data.gifUrl, instructions: data.instructions || [],
            bodyPart: data.bodyPart || '',
          };
          setGifUrl(info.gifUrl);
          setInstructions(info.instructions);
          await cacheExercise(info);
        }
      }
    } catch {}
    setGifLoading(false);
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
    if (processingRef.current) return;
    processingRef.current = true;

    const r = parseInt(reps) || 0;
    const w = parseFloat(weight) || 0;
    setTotalReps(prev => prev + r);
    setWeights(prev => [...prev, w]);
    setSetsCompleted(prev => prev + 1);
    playSetComplete();
    hapticSetComplete();
    setJustScored(true);
    setTimeout(() => setJustScored(false), 400);

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

    setTimeout(() => {
      processingRef.current = false;
    }, 600);
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

        {/* ===== GAMIFIED FIGHTER ARENA ===== */}
        <div className={`fighter-arena ${arenaShake ? 'shake' : ''}`}>
          {flash && <div className="arena-flash" />}

          {/* Health Bars */}
          <div className="hb-row">
            <div className="hb-col">
              <div className="hb-labels">
                <span className="hb-name green">{avatar.yourCharacterName}</span>
                <span className="hb-pct green">
                  {ghost ? `${Math.round(Math.min((myScore / Math.max(ghostTarget, 1)) * 100, 100))}%` : '—'}
                </span>
              </div>
              <div className="hb-track">
                <div className="hb-fill" style={{
                  width: `${ghost ? Math.min((myScore / Math.max(ghostTarget, myScore, 1)) * 100, 100) : (myScore > 0 ? 100 : 0)}%`,
                  background: ahead || !ghost ? 'linear-gradient(90deg, #00FF87, #00CC6A)' : 'linear-gradient(90deg, #FFB800, #FF8C00)'
                }} />
              </div>
            </div>
            <div className="hb-vs">VS</div>
            <div className="hb-col">
              <div className="hb-labels">
                <span className="hb-ghost-info">{ghost ? (isCardio ? formatTime(ghostTarget) : `${ghostTarget} target`) : 'NO DATA'}</span>
                <span className="hb-name ghost-name">{(ghost as any)?.isInitiation ? 'DAY 1 TARGET' : avatar.ghostCharacterName}</span>
              </div>
              <div className="hb-track">
                <div className="hb-fill ghost-fill" style={{ width: ghost ? '100%' : '0%' }} />
              </div>
            </div>
          </div>

          {/* Fighters Row */}
          <div className="fighters-row">
            {/* YOUR FIGHTER */}
            <div className={`fighter-card-wrap ${justScored ? 'fc-scored' : ''}`}>
              <div className="fc-score green">{isCardio ? formatTime(seconds) : totalReps}</div>
              <div className="fc-card" style={{
                background: 'linear-gradient(135deg, #0D1F0D, #141414)',
                borderColor: tier >= 4 ? '#FFD700' : '#00FF87',
                boxShadow: (ahead || justScored)
                  ? `0 0 20px ${tier >= 4 ? 'rgba(255,215,0,0.3)' : 'rgba(0,255,135,0.25)'}, inset 0 0 15px ${tier >= 4 ? 'rgba(255,215,0,0.15)' : 'rgba(0,255,135,0.15)'}` : 'none',
              }}>
                <div className="fc-avatar">
                  {avatar.yourUsesPhoto && avatar.yourPhotoUrl ? (
                    <img src={avatar.yourPhotoUrl} alt="You" className="fc-photo" />
                  ) : (
                    <svg viewBox="0 0 60 70" width="60" height="70" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="30" cy="16" r="10" fill={tier >= 4 ? '#FFD700' : '#00FF87'} opacity="0.9"/>
                      <circle cx="27" cy="15" r="2" fill="#0A0A0A"/>
                      <circle cx="33" cy="15" r="2" fill="#0A0A0A"/>
                      <path d={ahead || justScored ? 'M 26 19 Q 30 22 34 19' : 'M 26 19 Q 30 20 34 19'} stroke="#0A0A0A" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      <rect x="20" y="28" width="20" height="20" rx="4" fill={tier >= 4 ? '#FFD700' : '#00FF87'} opacity="0.8"/>
                      <rect x="8" y="28" width="10" height="6" rx="3" fill={tier >= 4 ? '#FFD700' : '#00FF87'} opacity="0.8"
                        transform={ahead || justScored ? 'rotate(-30, 13, 31)' : 'rotate(0)'}/>
                      <rect x="42" y="28" width="10" height="6" rx="3" fill={tier >= 4 ? '#FFD700' : '#00FF87'} opacity="0.8"/>
                      <rect x="21" y="46" width="7" height="14" rx="3" fill={tier >= 4 ? '#FFD700' : '#00FF87'} opacity="0.7"/>
                      <rect x="32" y="46" width="7" height="14" rx="3" fill={tier >= 4 ? '#FFD700' : '#00FF87'} opacity="0.7"/>
                      {tier >= 5 && <text x="30" y="8" textAnchor="middle" fontSize="8">👑</text>}
                    </svg>
                  )}
                </div>
                {justScored && <div className="fc-flash" />}
                <div className="fc-tier-badge" style={{ background: tier >= 4 ? '#FFD700' : '#00FF87' }}>{tier}</div>
              </div>
              <div className="fc-label green">{avatar.yourCharacterName}</div>
            </div>

            {/* CENTER STATUS */}
            <div className="fighter-center">
              {myScore === 0 && ghostTarget === 0 ? (
                <div className="fc-dots"><div className="fc-dot" /><div className="fc-dot" /><div className="fc-dot" /></div>
              ) : (ghost as any)?.isInitiation && myScore === 0 ? (
                <div className="fc-status-behind">
                  <span className="fc-status-text yellow" style={{fontSize: 9}}>SET YOUR BENCHMARK 🎯</span>
                </div>
              ) : ahead ? (
                <div className="fc-status-pulse">
                  <span className="fc-status-text green">WINNING</span>
                  <span className="fc-status-icon">⚡</span>
                </div>
              ) : tied ? (
                <div className="fc-status-pulse">
                  <span className="fc-status-text yellow">TIED</span>
                  <span className="fc-status-icon">🔥</span>
                </div>
              ) : (
                <div className="fc-status-behind">
                  <span className="fc-behind-text">{ghostTarget - myScore} back</span>
                  <span className="fc-status-icon dim">👻</span>
                </div>
              )}
            </div>

            {/* GHOST FIGHTER */}
            <div className="fighter-card-wrap">
              <div className="fc-score gray">{ghost ? (isCardio ? formatTime(ghost.totalDuration) : ghost.totalReps) : '—'}</div>
              <div className="fc-card ghost-card" style={{
                background: 'linear-gradient(135deg, #1A1A2E, #141414)',
                borderColor: 'rgba(255,255,255,0.15)',
                opacity: ahead ? 0.4 : 0.7,
                boxShadow: !ahead && ghost ? '0 0 15px rgba(255,255,255,0.05)' : 'none',
              }}>
                <div className="fc-avatar">
                  {avatar.ghostUsesPhoto && avatar.ghostPhotoUrl ? (
                    <img src={avatar.ghostPhotoUrl} alt="Ghost" className="fc-photo ghost-photo" />
                  ) : (
                    <svg viewBox="0 0 60 70" width="60" height="70" xmlns="http://www.w3.org/2000/svg">
                      {(ghost as any)?.isInitiation ? (
                        <text x="30" y="45" textAnchor="middle" fontSize="30" fill="rgba(255,255,255,0.4)">🎯</text>
                      ) : (
                        <g>
                          <path d="M 15 35 Q 15 15 30 10 Q 45 15 45 35 L 45 60 Q 40 55 35 60 Q 30 55 25 60 Q 20 55 15 60 Z"
                            fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                          <circle cx="25" cy="28" r="4" fill="rgba(255,255,255,0.6)"/>
                          <circle cx="35" cy="28" r="4" fill="rgba(255,255,255,0.6)"/>
                          <circle cx="26" cy="29" r="2" fill="#0A0A0A"/>
                          <circle cx="36" cy="29" r="2" fill="#0A0A0A"/>
                          {!ahead ? (
                            <path d="M 24 36 Q 30 40 36 36" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                          ) : (
                            <path d="M 24 38 Q 30 34 36 38" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                          )}
                        </g>
                      )}
                    </svg>
                  )}
                </div>
                {ahead && !(ghost as any)?.isInitiation && <div className="fc-defeated">💀</div>}
              </div>
              <div className="fc-label ghost-label">{avatar.ghostCharacterName}</div>
            </div>
          </div>

          {/* First time message */}
          {!ghost && (
            <div className="fc-first-time">First time — set your benchmark 👻</div>
          )}

          {/* Arena floor line */}
          <div className="arena-floor" />
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
            <div className="relative w-full rounded-2xl overflow-hidden bg-[#141414]" style={{ aspectRatio: '16/9' }}>
              <div className="gif-shimmer" style={{ height: '100%' }} />
            </div>
          ) : videoId ? (
            <YouTubeEmbed videoId={videoId} />
          ) : (
            // Fallback: show premium GIF if video unavailable
            gifLoading ? (
              <div className="gif-premium"><div className="gif-shimmer" style={{ height: '100%' }} /></div>
            ) : gifUrl ? (
              <div className="gif-premium">
                <img src={gifUrl} alt={`${exercise.name} demonstration`} loading="lazy" />
                <div className="gif-vignette" />
                <div className="gif-badge">
                  <p>Proper Form</p>
                </div>
              </div>
            ) : (
              <div className="gif-placeholder" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span>🏋️</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Video unavailable</span>
              </div>
            )
          )}
        </div>

        {/* GIF below YouTube (if both available) */}
        {gifUrl && videoId && (
          <div style={{ padding: '0 20px' }}>
            <div className="gif-premium">
              <img src={gifUrl} alt={`${exercise.name} form guide`} loading="lazy" />
              <div className="gif-vignette" />
              <div className="gif-badge">
                <p>Proper Form</p>
              </div>
            </div>
          </div>
        )}

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
              <button
                className="btn-primary"
                onPointerDown={completeSet}
                disabled={false}
                style={{ touchAction: 'manipulation' }}
              >
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
