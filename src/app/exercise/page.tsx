'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getCurrentPlan, getGhostHistory, saveGhostSession, getWinCount, getAllSessions, getCachedExercise, cacheExercise, getStreak, getAllTimeBest, updateCachedVideoId, getProfile, awardSoulCoins, getDaysSinceLastWorkout } from '@/lib/db';
import { identifyExercise, PATTERN_LABELS, type ExerciseIdentity } from '@/lib/exercise-identity';
import { Exercise, GhostSession, ExerciseInfo, calculateTier } from '@/lib/types';
import { progressionCue } from '@/lib/training-science';
import {
  formatScore, formatScoreCompact, liveScore, readGhost, readPace, shortUnit, verdictLine,
  type GhostMood, type GhostRead,
} from '@/lib/ghost-engine';
import { useAppStore } from '@/store/appStore';
import { Avatar } from '@/components/Avatar';
import { SmartLogger } from '@/components/SmartLogger';
import { checkMilestones, MilestoneEvent } from '@/lib/milestones';
import { playSetComplete, playGhostBeaten, playGiveUp, playMilestone, hapticSetComplete, hapticGhostBeaten, hapticGiveUp, hapticMilestone } from '@/lib/sound';
import { arcadeSounds, initAudio } from '@/utils/arcadeSounds';
import Celebration from '@/components/Celebration';

interface SetEntry {
  reps?: number;
  weight?: number;
  duration?: number;
}

/** How the ghost's current mood reads in the arena. */
const MOOD_META: Record<GhostMood, { label: string; color: string; emoji: string }> = {
  first_meeting: { label: 'FIRST MEETING', color: '#5AC8FA', emoji: '👻' },
  hunting:       { label: 'HUNTING',       color: '#FF4444', emoji: '🔥' },
  pressuring:    { label: 'PRESSURING',    color: '#FF8A3D', emoji: '⚡' },
  measured:      { label: 'MATCHING YOU',  color: '#FFD700', emoji: '👁️' },
  waiting:       { label: 'WAITING',       color: '#7ED957', emoji: '🫱' },
  protective:    { label: 'STANDING DOWN', color: '#5AC8FA', emoji: '🛡️' },
};

function ComboAnnouncer({ combo }: { combo: number | null }) {
  if (!combo || combo < 2) return null;
  const text = combo === 2 ? 'COMBO x2!' : combo === 3 ? 'COMBO x3! 🔥' : 'UNSTOPPABLE! ⚡';
  const color = combo === 2 ? 'text-yellow-400' : combo === 3 ? 'text-orange-400' : 'text-red-400';
  return (
    <div className={`absolute top-4 left-0 right-0 text-center font-black text-xl ${color} animate-bounce pointer-events-none z-50`} style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
      {text}
    </div>
  );
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
  const { profile, refreshProfile } = useAppStore();
  const params = useSearchParams();
  const idx = parseInt(params.get('idx') || '0');

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [ghost, setGhost] = useState<GhostRead | null>(null);
  /** Resolved lift identity — stamped onto the session so history survives rotations. */
  const [identity, setIdentity] = useState<ExerciseIdentity | null>(null);
  /** Weight used last time on this lift — prefilled so logging is one tap. */
  const [lastWeight, setLastWeight] = useState(0);
  const [tier, setTier] = useState(1);

  // Strength state
  const [currentSet, setCurrentSet] = useState(1);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [totalReps, setTotalReps] = useState(0);
  const [weights, setWeights] = useState<number[]>([]);
  const [setsCompleted, setSetsCompleted] = useState(0);
  const [setLog, setSetLog] = useState<SetEntry[]>([]);

  // Cardio state
  const [seconds, setSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // UI state
  const [showGiveUp, setShowGiveUp] = useState(false);
  const [result, setResult] = useState<'win' | 'loss' | 'first' | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [prNew, setPrNew] = useState(false);
  const [arenaShake, setArenaShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [justScored, setJustScored] = useState(false);

  // State for rest timer
  const [isResting, setIsResting] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const restIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Rest comes from the exercise's own prescription — a heavy compound needs
   * two to three minutes to restore force output, an isolation set does not.
   * The goal-level fallback only applies to plans that predate the engine.
   */
  function getRestDuration(exercise: Exercise | null, goal: string): number {
    if (exercise?.restSeconds) return exercise.restSeconds;
    return ({
      strength: 150, muscle: 105, shredded: 60, fitness: 75,
    } as Record<string, number>)[(goal || '').toLowerCase()] ?? 90;
  }

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

  // RPG Layer: Coins & Combos & Sounds
  const [unlockedCosmetics, setUnlockedCosmetics] = useState<string[]>([]);
  const [coinAnim, setCoinAnim] = useState<number | null>(null);
  const [showCombo, setShowCombo] = useState<number | null>(null);
  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Video fallback state
  const [videoBlocked, setVideoBlocked] = useState(false);

  async function load() {
    try {
      const plan = await getCurrentPlan();
      if (!plan) { router.replace('/'); return; }
      const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
      const td = plan.days.find(d => d.dayName === todayDayName) || plan.days[0];
      if (!td || idx >= td.exercises.length) { router.replace('/workout'); return; }
      const ex = td.exercises[idx];
      setExercise(ex);

      // The ghost reads this lift's own history for the number, and the wider
      // movement pattern for momentum — so rotating Barbell Bench to Dumbbell
      // Bench at the start of a block does not wipe the slate.
      const identity = identifyExercise(ex);
      const [history, daysSinceAnyWorkout] = await Promise.all([
        getGhostHistory({ ...ex, movementPattern: identity?.pattern }, 6),
        getDaysSinceLastWorkout(),
      ]);
      setIdentity(identity);
      setGhost(readGhost(ex, {
        history: history.same,
        relatedHistory: history.related,
        patternLabel: identity ? PATTERN_LABELS[identity.pattern] : undefined,
        phase: plan.meta?.phase,
        daysSinceAnyWorkout,
      }));
      setLastWeight(Math.round(history.same[0]?.avgWeight ?? 0));

      const profile = await getProfile();
      if (profile) setUnlockedCosmetics(profile.unlockedCosmetics || []);
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

  useEffect(() => {
    document.addEventListener('pointerdown', initAudio, { once: true });
    const timer = window.setTimeout(() => {
      setSoundEnabled(localStorage.getItem('ghostfit_sound_enabled') !== 'false');
      void refreshProfile().then(load);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      if (timerRef.current) clearInterval(timerRef.current);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, [refreshProfile]);

  function addSetToSession(data: SetEntry) {
    const r = data.reps || 0;
    const w = data.weight || 0;
    const d = data.duration || 0;

    if (exercise?.metricType === 'cardio') {
      setSeconds(d);
      finishExercise(0, 1, 0, d);
      return;
    }

    if (exercise?.metricType === 'duration') {
      setTotalReps(prev => prev + 1); // treat 1 hold as 1 rep for arena
      setSeconds(prev => prev + d);
      setSetsCompleted(prev => prev + 1);
    } else {
      setTotalReps(prev => prev + r);
      setWeights(prev => [...prev, w]);
      setSetsCompleted(prev => prev + 1);
    }
    const nextLog = [...setLog, { reps: r, weight: w, duration: d }];
    setSetLog(nextLog);

    playSetComplete();
    hapticSetComplete();
    if (soundEnabled) arcadeSounds.setComplete();
    setJustScored(true);
    setTimeout(() => setJustScored(false), 400);

    const newCombo = currentSet;
    setShowCombo(newCombo);
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => setShowCombo(null), 1200);

    // Scored in the ghost's unit — for a weighted lift that means load, so a
    // set of 8 at 40 kg outranks 20 at 5 kg instead of losing to it.
    if (ghost) {
      const score = liveScore(nextLog, ghost.unit);
      if (score >= ghost.target) {
        setFlash(true);
        setTimeout(() => setFlash(false), 500);
      } else if (score >= (ghost.perSetTarget[Math.min(nextLog.length - 1, ghost.perSetTarget.length - 1)] ?? 0)) {
        setArenaShake(true);
        setTimeout(() => setArenaShake(false), 300);
      }
    }
  }

  function handleSetComplete(data: SetEntry) {
    addSetToSession(data);

    if (currentSet >= (exercise?.sets || 3)) {
      if (exercise?.metricType !== 'cardio') {
        const r = data.reps || 0;
        const w = data.weight || 0;
        const d = data.duration || 0;
        finishExercise(totalReps + r, setsCompleted + 1, w, seconds + d);
      }
      return;
    }

    setCurrentSet(s => s + 1);

    const mt = exercise?.metricType;
    if (mt === 'cardio' || mt === 'duration') return;

    const duration = getRestDuration(exercise, profile?.goal ?? 'muscle');
    setRestSeconds(duration);
    setIsResting(true);

    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    restIntervalRef.current = setInterval(() => {
      setRestSeconds(s => {
        if (s <= 1) {
          clearInterval(restIntervalRef.current!);
          setIsResting(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function handleSkipRest() {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setIsResting(false);
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
    // `weights` has not yet re-rendered with the final set, so fold it in here.
    // Using only the last set's weight would skew the load score on a ramp.
    const allWeights = avgW > 0 ? [...weights, avgW] : weights;
    const avgWeight = allWeights.length > 0
      ? allWeights.reduce((a, b) => a + b, 0) / allWeights.length
      : 0;

    // Judge on the ghost's own unit, and let matching the target count as a
    // win. Missing by nothing after a full honest session is not a defeat.
    const unit = ghost?.unit ?? (isCardio ? 'seconds' : 'reps');
    const myScore = unit === 'seconds'
      ? (duration || seconds)
      : unit === 'load'
        ? Math.round(reps * Math.max(avgWeight, 1))
        : reps;
    const ghostTarget = ghost?.target ?? 0;
    const won = ghost ? myScore >= ghostTarget : false;
    const res: 'win' | 'loss' | 'first' = ghost?.isFirstMeeting && won
      ? 'first'
      : ghost ? (won ? 'win' : 'loss') : 'first';

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
      totalReps: reps, avgWeight: avgWeight,
      totalDuration: duration || seconds, setsCompleted: sets,
      result: res === 'first' ? 'win' : res, characterTier: tier,
      libraryId: exercise.libraryId ?? identity?.libraryId,
      movementPattern: exercise.movementPattern ?? identity?.pattern,
    };
    await saveGhostSession(session);

    if (ghost) setVerdict(verdictLine(ghost, myScore, isNewPR));

    const margin = ghostTarget > 0 ? ((myScore - ghostTarget) / ghostTarget) * 100 : 50;
    const earned = await awardSoulCoins(res === 'first' ? 'win' : res, margin);
    if (earned > 0) {
      setCoinAnim(earned);
      if (soundEnabled) arcadeSounds.coinEarned();
      setTimeout(() => setCoinAnim(null), 1500);
    }

    if (won) { playGhostBeaten(); hapticGhostBeaten(); if (soundEnabled) arcadeSounds.ghostBeaten(); }
    if (isNewPR && soundEnabled) arcadeSounds.newRecord();
    setPrNew(isNewPR);

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
  }, [exercise, ghost, identity, seconds, soundEnabled, tier, weights]);

  async function handleGiveUp() {
    if (!exercise) return;
    const session: GhostSession = {
      id: crypto.randomUUID(), exerciseName: exercise.name, date: Date.now(),
      totalReps, avgWeight: weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0,
      totalDuration: seconds, setsCompleted, result: 'loss', characterTier: tier,
      libraryId: exercise.libraryId ?? identity?.libraryId,
      movementPattern: exercise.movementPattern ?? identity?.pattern,
    };
    await saveGhostSession(session);
    
    const earned = await awardSoulCoins('loss', 0);
    if (earned > 0) {
      setCoinAnim(earned);
      if (soundEnabled) arcadeSounds.coinEarned();
      setTimeout(() => setCoinAnim(null), 1500);
    }

    playGiveUp(); hapticGiveUp();
    if (soundEnabled) arcadeSounds.giveUp();
    setResult('loss');
    setShowGiveUp(false);
  }

  if (!exercise) return <div className="loading"><div className="loader" /></div>;
  const isCardio = exercise.type === 'cardio' || exercise.metricType === 'duration';
  const scoreUnit = ghost?.unit ?? (isCardio ? 'seconds' : 'reps');
  const ghostTarget = ghost?.target ?? 0;
  const myScore = liveScore(setLog, scoreUnit);
  const ahead = ghost ? myScore >= ghostTarget : false;
  const tied = false;
  const mood = ghost ? MOOD_META[ghost.mood] : null;
  const pace = ghost
    ? readPace(ghost, myScore, setLog.length, Math.max(1, exercise.sets ?? 3))
    : null;
  const onPace = pace ? pace.ahead : true;

  const instrToShow = showAllInstr ? instructions : instructions.slice(0, 2);

  // RPG Cosmetics Setup
  const auraColor = (() => {
    if (unlockedCosmetics.includes('aura_fire')) return 'rgba(255,107,53,0.5)';
    if (unlockedCosmetics.includes('aura_ice')) return 'rgba(0,212,255,0.4)';
    if (unlockedCosmetics.includes('aura_lightning')) return 'rgba(255,215,0,0.45)';
    if (unlockedCosmetics.includes('aura_gold')) return 'rgba(255,215,0,0.6)';
    return tier >= 4 ? '#FFD700' : '#00FF87';
  })();
  const headgear = (() => {
    if (unlockedCosmetics.includes('head_crown')) return '👑';
    if (unlockedCosmetics.includes('head_ninja')) return '🥷';
    if (unlockedCosmetics.includes('head_horns')) return '😈';
    return null;
  })();
  const badge = (() => {
    if (unlockedCosmetics.includes('badge_skull')) return '💀';
    if (unlockedCosmetics.includes('badge_streak')) return '🔥';
    return null;
  })();
  const glitchClass = unlockedCosmetics.includes('effect_glitch') ? 'animate-glitch' : '';
  const rainbowClass = unlockedCosmetics.includes('effect_rainbow') ? 'fc-rainbow' : '';

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
          {result !== 'loss' && <Celebration big={prNew} />}
          <div className="result-icon">{result === 'win' ? (prNew ? '🏆' : '🔥') : result === 'first' ? '👻' : '💀'}</div>
          {prNew && result === 'win' && <div className="pr-banner">NEW PERSONAL RECORD</div>}
          <h2>{result === 'win' ? 'YOU BEAT YOUR GHOST' : result === 'first' ? 'GHOST DATA SAVED' : 'GHOST HELD THIS ONE'}</h2>
          <p>{verdict ?? (result === 'first'
            ? 'Beat this next time you do this exercise.'
            : "Tomorrow's you will remember this.")}</p>
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
          
          {coinAnim !== null && (
            <div className="absolute top-4 right-4 animate-bounce text-[#00FF87] font-black text-sm pointer-events-none z-50">
              +{coinAnim} ⚡
            </div>
          )}
          <ComboAnnouncer combo={showCombo} />

          {/* Health Bars */}
          <div className="hb-row">
            <div className="hb-col">
              <div className="hb-labels">
                <span className="hb-name green">{profile?.characterName ?? 'YOU'}</span>
                <span className="hb-pct green">
                  {ghost ? `${Math.round(Math.min((myScore / Math.max(ghostTarget, 1)) * 100, 100))}%` : '—'}
                </span>
              </div>
              <div className="hb-track">
                <div className="hb-fill" style={{
                  width: `${ghost ? Math.min((myScore / Math.max(ghostTarget, myScore, 1)) * 100, 100) : (myScore > 0 ? 100 : 0)}%`,
                  background: onPace || !ghost ? 'linear-gradient(90deg, #00FF87, #00CC6A)' : 'linear-gradient(90deg, #FFB800, #FF8C00)'
                }} />
                {/* The ghost's pace marker — where it expects you to be right now */}
                {ghost && pace && pace.expected > 0 && (
                  <div className="hb-pace-marker" style={{
                    left: `${Math.min(100, (pace.expected / Math.max(ghostTarget, myScore, 1)) * 100)}%`,
                  }} />
                )}
              </div>
            </div>
            <div className="hb-vs">VS</div>
            <div className="hb-col">
              <div className="hb-labels">
                <span className="hb-ghost-info">{ghost ? formatScore(ghostTarget, scoreUnit) : 'NO DATA'}</span>
                <span className="hb-name ghost-name">{ghost?.isFirstMeeting ? 'DAY 1 TARGET' : (profile?.ghostName ?? 'GHOST')}</span>
              </div>
              <div className="hb-track">
                <div className="hb-fill ghost-fill" style={{ width: ghost ? '100%' : '0%' }} />
              </div>
            </div>
          </div>

          {/* Mood — what the ghost is doing today, and why */}
          {ghost && mood && (
            <div className="ghost-mood">
              <span className="ghost-mood-tag" style={{ color: mood.color, borderColor: mood.color }}>
                {mood.emoji} {mood.label}
              </span>
              <span className="ghost-mood-line">{pace?.line ?? ghost.headline}</span>
            </div>
          )}

          {/* Fighters Row */}
          <div className="fighters-row">
            {/* YOUR FIGHTER */}
            <div className={`fighter-card-wrap ${justScored ? 'fc-scored' : ''} ${rainbowClass}`} style={{ position: 'relative' }}>
              {headgear && <div className="absolute top-0 left-1/2 text-2xl z-20" style={{ transform: 'translate(-50%, -60%)' }}>{headgear}</div>}
              {badge && <div className="absolute bottom-0 right-0 text-sm z-20 bg-[#141414] rounded-full border border-gray-700 shadow-lg" style={{ padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, transform: 'translate(40%, 40%)' }}>{badge}</div>}

              <div className="fc-score green">{formatScoreCompact(myScore, scoreUnit)}</div>
              <div className={`fc-card your-card ${glitchClass}`} style={{
                background: 'linear-gradient(135deg, #0D1F0D, #141414)',
                borderColor: auraColor,
                boxShadow: (ahead || justScored)
                  ? `0 0 20px ${auraColor}, inset 0 0 15px ${auraColor}` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Avatar type="user" size={72} tier={tier} animationState={ahead || justScored ? 'celebrating' : 'idle'} />
                {justScored && <div className="fc-flash" />}
              </div>
              <div className="fc-label green">{profile?.characterName ?? 'YOU'}</div>
            </div>

            {/* CENTER STATUS */}
            <div className="fighter-center">
              {myScore === 0 && ghostTarget === 0 ? (
                <div className="fc-dots"><div className="fc-dot" /><div className="fc-dot" /><div className="fc-dot" /></div>
              ) : ghost?.isFirstMeeting && myScore === 0 ? (
                <div className="fc-status-behind">
                  <span className="fc-status-text yellow" style={{fontSize: 9}}>SET YOUR BENCHMARK 🎯</span>
                </div>
              ) : ahead ? (
                <div className="fc-status-pulse">
                  <span className="fc-status-text green">{myScore >= (ghost?.stretchTarget ?? Infinity) ? 'DOMINANT' : 'WINNING'}</span>
                  <span className="fc-status-icon">⚡</span>
                </div>
              ) : onPace ? (
                <div className="fc-status-pulse">
                  <span className="fc-status-text yellow">ON PACE</span>
                  <span className="fc-status-icon">🔥</span>
                </div>
              ) : (
                <div className="fc-status-behind">
                  <span className="fc-behind-text">{formatScore(ghostTarget - myScore, scoreUnit)} back</span>
                  <span className="fc-status-icon dim">👻</span>
                </div>
              )}
            </div>

            {/* GHOST FIGHTER */}
            <div className="fighter-card-wrap">
              <div className="fc-score gray">{ghost ? formatScoreCompact(ghost.target, scoreUnit) : '—'}</div>
              <div className="fc-card ghost-card" style={{
                background: 'linear-gradient(135deg, #1A1A2E, #141414)',
                borderColor: 'rgba(255,255,255,0.15)',
                opacity: ahead ? 0.4 : 0.7,
                boxShadow: !ahead && ghost ? '0 0 15px rgba(255,255,255,0.05)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Avatar type="ghost" size={72} animationState={ahead ? 'losing' : 'idle'} />
                {ahead && !ghost?.isFirstMeeting && <div className="fc-defeated">💀</div>}
              </div>
              <div className="fc-label ghost-label">{profile?.ghostName ?? 'GHOST'}</div>
            </div>
          </div>

          {/* First time message */}
          {!ghost && (
            <div className="fc-first-time">First time — set your benchmark 👻</div>
          )}

        {/* Arena floor line */}
        <div className="arena-floor" />
      </div>

      {/* Exercise info - added px-5 */}
      <div className="ex-detail px-5 mt-2">
        <h2 className="text-xl font-black">{exercise.name}</h2>
      </div>

      {/* Tutorial — true full bleed */}
      <div className="mb-4">
        <div className="px-5 mb-1.5 flex items-center justify-between">
          <p className="text-[#00FF87] text-[10px] font-black
                        tracking-widest uppercase">
            Tutorial
          </p>
          {videoId && (
            <p className="text-gray-700 text-[9px] font-bold">YouTube</p>
          )}
        </div>

        <div className="relative w-full bg-[#141414] overflow-hidden"
             style={{ aspectRatio: '16/9', border: 'none' }}>

            {/* Skeleton while loading */}
            {videoLoading && (
              <div className="absolute inset-0 flex flex-col items-center
                              justify-center gap-3 animate-pulse">
                <div className="w-14 h-14 rounded-full bg-[#1F1F1F]
                                flex items-center justify-center">
                  <span className="text-gray-700 text-2xl">▶</span>
                </div>
                <p className="text-gray-700 text-xs uppercase tracking-widest font-bold">
                  Loading tutorial...
                </p>
              </div>
            )}

            {/* YouTube — no border, no radius, edge to edge */}
            {videoId && !videoBlocked && (
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
                className={`absolute inset-0 w-full h-full transition-opacity duration-300
                  ${videoLoading ? 'opacity-0' : 'opacity-100'}`}
                style={{ border: 'none' }}
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write;
                       encrypted-media; gyroscope; picture-in-picture"
                onLoad={() => setVideoLoading(false)}
                onError={() => { setVideoBlocked(true); setVideoLoading(false) }}
              />
            )}

            {/* GIF fallback */}
            {(videoBlocked || !videoId) && gifUrl && !videoLoading && (
              <img src={gifUrl} alt={`${exercise.name} demonstration`}
                   className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* No media at all */}
            {(videoBlocked || !videoId) && !gifUrl && !videoLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-600 text-sm">No tutorial available</p>
              </div>
            )}
          </div>
        </div>

        {/* Why the ghost set this number — never a mystery, never a guilt trip */}
        {ghost && mood && (
          <div className="ghost-brief px-5 mb-4" style={{ borderColor: `${mood.color}44` }}>
            <div className="ghost-brief-head">
              <span style={{ color: mood.color }}>{mood.emoji} {ghost.headline}</span>
              {ghost.carriedFrom ? (
                <span className="ghost-brief-meta carried">
                  🔗 carried over from your {ghost.carriedFrom}
                </span>
              ) : !ghost.isFirstMeeting ? (
                <span className="ghost-brief-meta">
                  from your last {ghost.sampleSize} {ghost.sampleSize === 1 ? 'session' : 'sessions'}
                </span>
              ) : null}
            </div>
            <p className="ghost-brief-reason">{ghost.reason}</p>
            <div className="ghost-brief-numbers">
              <div>
                <span className="ghost-brief-label">To beat</span>
                <strong style={{ color: mood.color }}>{formatScore(ghost.target, scoreUnit)}</strong>
              </div>
              {!ghost.isFirstMeeting && ghost.best > 0 && (
                <div>
                  <span className="ghost-brief-label">Your best</span>
                  <strong>{formatScore(ghost.best, scoreUnit)}</strong>
                </div>
              )}
              <div>
                <span className="ghost-brief-label">Statement</span>
                <strong>{formatScore(ghost.stretchTarget, scoreUnit)}</strong>
              </div>
            </div>
            {scoreUnit === 'load' && (
              <p className="ghost-brief-foot">
                Scored on {shortUnit(scoreUnit)} — reps × weight. Dropping the weight to add reps will not beat it.
              </p>
            )}
          </div>
        )}

        {/* Prescription — the numbers that make the set count for something */}
        {(exercise.targetRir !== undefined || exercise.restSeconds || exercise.coachNote) && (
          <div className="ex-prescription px-5 mb-4">
            <div className="ex-prescription-chips">
              {exercise.repMin && exercise.repMax && (
                <span className="ex-chip">🎯 {exercise.repMin}–{exercise.repMax} reps</span>
              )}
              {exercise.targetRir !== undefined && (
                <span className="ex-chip">
                  {exercise.targetRir === 0 ? '💥 Last set to failure' : `🛑 Stop with ${exercise.targetRir} left`}
                </span>
              )}
              {exercise.restSeconds ? (
                <span className="ex-chip">
                  ⏱ {exercise.restSeconds >= 60 ? `${Math.round(exercise.restSeconds / 6) / 10} min` : `${exercise.restSeconds}s`} rest
                </span>
              ) : null}
              {exercise.tempo && <span className="ex-chip">🕒 Tempo {exercise.tempo}</span>}
            </div>
            {exercise.coachNote && <p className="ex-coach-note">💡 {exercise.coachNote}</p>}
            {exercise.repMin && exercise.repMax && (
              <p className="ex-progression">{progressionCue(exercise.repMin, exercise.repMax, exercise.metricType)}</p>
            )}
          </div>
        )}

        {/* Instructions - added px-5 */}
        {instructions.length > 0 && (
          <div className="instructions-list px-5 mb-4">
            {instrToShow.map((step, i) => (
              <div className="instr-step" key={i}>
                <div className="instr-num">{i + 1}</div>
                <span className="text-sm">{step}</span>
              </div>
            ))}
            {instructions.length > 2 && (
              <button className="show-more-btn" onClick={() => setShowAllInstr(!showAllInstr)}>
                {showAllInstr ? 'Show less ↑' : `Show all ${instructions.length} steps ↓`}
              </button>
            )}
          </div>
        )}

        {/* Smart Logger area — fixed at bottom or scrollable based on content */}
        <div className="logger mt-auto border-t border-white/5 bg-black/40 backdrop-blur-md">
          <SmartLogger
            exercise={exercise}
            currentSet={currentSet}
            onSetComplete={handleSetComplete}
            ghostDuration={scoreUnit === 'seconds' ? (ghost?.target ?? 0) : 0}
            isResting={isResting}
            restSeconds={restSeconds}
            onSkipRest={handleSkipRest}
            completedSets={setLog}
            // The incremental target for the set in front of you, not a flat
            // average — the ghost front-loads, the way real sets actually go.
            ghostPerSet={
              !ghost || exercise.metricType === 'cardio' ? null
              : Math.max(1, (ghost.perSetTarget[currentSet - 1] ?? ghost.target)
                  - (ghost.perSetTarget[currentSet - 2] ?? 0))
            }
            ghostUnit={scoreUnit}
            defaultWeight={lastWeight}
            defaultReps={exercise.repMin ?? exercise.reps ?? 0}
          />
        </div>

        {/* Bottom utility bar */}
        <div className="sl-footer mt-auto">
          <button 
            className="sl-footer-btn"
            onClick={() => setShowGiveUp(true)}
          >
            End Workout Early
          </button>
          
          <div className="sl-footer-sys">
            SYSTEM V1.4 // {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
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
