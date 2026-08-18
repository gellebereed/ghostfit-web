/**
 * GhostFit — Adaptive Ghost
 *
 * The old ghost was a ratchet: beat your last session's rep count, every
 * session, forever. Two problems. It measured the wrong thing — twenty sloppy
 * reps at 5 kg "beat" ten hard reps at 40 kg — and it was unwinnable by
 * construction, because nobody sets a personal record every time they train.
 * A target you always miss stops being a target and starts being a reason to
 * quit.
 *
 * This ghost does two things instead.
 *
 * It scores what actually matters: total load (reps × weight) for weighted
 * lifts, reps for bodyweight, seconds for holds and cardio. You cannot beat it
 * by dropping the weight and pumping out reps.
 *
 * And it reads the room. It looks at your recent sessions on this exact
 * exercise and sets a target you can genuinely reach today: after two bad
 * sessions it lowers the bar and says so, after three good ones it raises it,
 * and during a deload or a comeback week it deliberately gets out of your way.
 * The target is always anchored to your own recent form, never to an abstract
 * benchmark, and it is capped so it can never drift more than a little above
 * your best day.
 */
import type { Exercise, GhostSession, TrainingPhase } from './types';

export type ScoreUnit = 'reps' | 'seconds' | 'load';

export type GhostMood =
  | 'first_meeting'  // no history — the prescription is the target
  | 'hunting'        // you are on a run; the ghost is chasing you hard
  | 'pressuring'     // you are winning; it pushes
  | 'measured'       // steady state
  | 'waiting'        // you have been losing; it backs off and holds the door
  | 'protective';    // deload, comeback, or a long gap — it stands down

export interface GhostRead {
  /** Score you must reach or exceed to win. */
  target: number;
  /** The number that makes this a statement session. */
  stretchTarget: number;
  unit: ScoreUnit;
  mood: GhostMood;
  /** One line of character — what the ghost is doing. */
  headline: string;
  /** Plain-English why. Never mystifying, never guilt-tripping. */
  reason: string;
  /** Cumulative score the ghost expects after each set — the pacing race. */
  perSetTarget: number[];
  /** Your reference form, before the handicap was applied. */
  baseline: number;
  /** Your best ever on this exercise, in the same unit. */
  best: number;
  /** Multiplier the ghost applied to your baseline. <1 = it eased off. */
  handicap: number;
  isFirstMeeting: boolean;
  /** Sessions the read is based on. */
  sampleSize: number;
  /**
   * Set when momentum was inherited from other variations of the same pattern
   * — the label of that pattern, so the ghost can say where it came from.
   */
  carriedFrom?: string;
}

export interface GhostContext {
  /** Newest first. Only sessions for this exact lift. */
  history: GhostSession[];
  /**
   * Newest first. Sessions on other variations of the same movement pattern.
   *
   * Loads are not comparable across variations — 30 kg dumbbell bench is not
   * 30 kg barbell bench — so these never set the target number. What they do
   * carry is momentum: whether you have been winning or struggling at this
   * *movement*, which is a fact about you and survives a variation swap.
   */
  relatedHistory?: GhostSession[];
  /** Human label for the shared pattern, e.g. "horizontal pressing". */
  patternLabel?: string;
  /** Where the program is — a deload ghost does not pick fights. */
  phase?: TrainingPhase;
  /** Days since the user trained at all. */
  daysSinceAnyWorkout?: number | null;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export function unitFor(exercise: Pick<Exercise, 'metricType' | 'type'>): ScoreUnit {
  const m = exercise.metricType || (exercise.type === 'cardio' ? 'cardio' : 'weight_reps');
  if (m === 'cardio' || m === 'duration') return 'seconds';
  if (m === 'weight_reps') return 'load';
  return 'reps';
}

/**
 * One comparable number per session.
 *
 * Load uses average weight rather than a per-set sum because that is what the
 * session record stores; with a steady working weight the two are identical,
 * and a dropped last set only understates the score slightly. Weight of zero
 * falls back to reps so an unweighted log is never scored as nothing.
 */
export function sessionScore(session: GhostSession, unit: ScoreUnit): number {
  if (unit === 'seconds') return Math.round(session.totalDuration ?? 0);
  if (unit === 'load') return Math.round((session.totalReps ?? 0) * Math.max(session.avgWeight ?? 0, 1));
  return Math.round(session.totalReps ?? 0);
}

/** The score a live, in-progress session has accumulated. */
export function liveScore(
  sets: Array<{ reps?: number; weight?: number; duration?: number }>,
  unit: ScoreUnit,
): number {
  if (unit === 'seconds') return Math.round(sets.reduce((sum, s) => sum + (s.duration ?? 0), 0));
  if (unit === 'load') {
    return Math.round(sets.reduce((sum, s) => sum + (s.reps ?? 0) * Math.max(s.weight ?? 0, 1), 0));
  }
  return Math.round(sets.reduce((sum, s) => sum + (s.reps ?? 0), 0));
}

/** What the plan itself asks for — the target when there is no history yet. */
export function prescribedScore(exercise: Exercise, unit: ScoreUnit): number {
  const sets = Math.max(1, exercise.sets ?? 3);
  if (unit === 'seconds') {
    if (exercise.metricType === 'cardio') return Math.max(60, exercise.durationSeconds ?? 600);
    return sets * Math.max(10, exercise.durationSeconds ?? 30);
  }
  const reps = exercise.repMin ?? exercise.reps ?? 10;
  // Load has no known weight before the first session, so the first meeting is
  // judged on reps and the unit switches once there is a weight on record.
  return sets * Math.max(1, reps);
}

export function formatScore(value: number, unit: ScoreUnit): string {
  if (unit === 'seconds') {
    const m = Math.floor(value / 60);
    const s = value % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
  }
  if (unit === 'load') return `${value.toLocaleString()} kg·reps`;
  return `${value} reps`;
}

/** Just the number — for the big arena scoreboards where the unit is implied. */
export function formatScoreCompact(value: number, unit: ScoreUnit): string {
  if (unit === 'seconds') {
    const m = Math.floor(value / 60);
    const s = value % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  if (unit === 'load' && value >= 10000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString();
}

export function shortUnit(unit: ScoreUnit): string {
  return unit === 'seconds' ? 'time' : unit === 'load' ? 'volume' : 'reps';
}

// ─── Reading your form ───────────────────────────────────────────────────────

interface Momentum {
  lossStreak: number;
  winStreak: number;
  recentWins: number;
}

interface Form extends Momentum {
  baseline: number;
  best: number;
  trend: 'up' | 'flat' | 'down';
  daysSinceThisExercise: number | null;
}

/**
 * Momentum from results alone.
 *
 * Deliberately score-free, which is what makes it portable: a win is a win
 * relative to whatever target that session faced, so wins on a dumbbell press
 * and wins on a barbell press stack into one streak even though their loads
 * are not comparable.
 */
function readMomentum(sessions: GhostSession[]): Momentum {
  const recent = sessions.slice(0, 6);

  let lossStreak = 0;
  for (const s of recent) {
    if (s.result === 'loss' || s.result === 'incomplete') lossStreak++;
    else break;
  }
  let winStreak = 0;
  for (const s of recent) {
    if (s.result === 'win') winStreak++;
    else break;
  }
  const recentWins = recent.slice(0, 3).filter(s => s.result === 'win').length;

  return { lossStreak, winStreak, recentWins };
}

function readForm(history: GhostSession[], unit: ScoreUnit): Form {
  const recent = history.slice(0, 6);
  const scores = recent.map(s => sessionScore(s, unit)).filter(v => v > 0);
  const best = scores.length ? Math.max(...scores) : 0;

  // Weighted toward the newest session: what you can do *today* matters more
  // than what you did a month ago, but one bad day should not erase your level.
  const weights = [0.45, 0.3, 0.15, 0.1];
  let weighted = 0;
  let used = 0;
  scores.slice(0, 4).forEach((score, i) => {
    weighted += score * weights[i];
    used += weights[i];
  });
  const baseline = used > 0 ? Math.round(weighted / used) : 0;

  let trend: Form['trend'] = 'flat';
  if (scores.length >= 3) {
    const newer = (scores[0] + scores[1]) / 2;
    const older = scores.slice(2, 4).reduce((a, b) => a + b, 0) / Math.min(2, scores.length - 2);
    if (newer > older * 1.04) trend = 'up';
    else if (newer < older * 0.96) trend = 'down';
  }

  const daysSinceThisExercise = history[0]
    ? Math.floor((Date.now() - history[0].date) / 86400000)
    : null;

  return { baseline, best, trend, daysSinceThisExercise, ...readMomentum(recent) };
}

// ─── The read ────────────────────────────────────────────────────────────────

interface MoodDecision {
  mood: GhostMood;
  handicap: number;
  headline: string;
  reason: string;
}

function decideMood(form: Form, phase: TrainingPhase | undefined, unit: ScoreUnit): MoodDecision {
  const noun = unit === 'seconds' ? 'time' : unit === 'load' ? 'volume' : 'reps';

  // Recovery weeks and comebacks override everything. A ghost that picks a
  // fight during a deload is fighting the program, not the user.
  if (phase === 'deload') {
    return {
      mood: 'protective', handicap: 0.75,
      headline: 'The ghost is standing down',
      reason: `Deload week. The bar is low on purpose — clear it comfortably and leave something in the tank. Chasing a record this week costs you next week.`,
    };
  }
  if (phase === 'reentry') {
    return {
      mood: 'protective', handicap: 0.7,
      headline: 'The ghost is holding the door',
      reason: `You are coming back, so it dropped the target well under your old ${noun}. Win small today. It gets its teeth back next week.`,
    };
  }

  const away = form.daysSinceThisExercise;
  if (away !== null && away >= 21) {
    return {
      mood: 'protective', handicap: 0.8,
      headline: 'The ghost remembers you',
      reason: `It has been ${away} days since you last did this. The target is set below your old ${noun} — you will be back past it within two sessions.`,
    };
  }

  if (form.lossStreak >= 3) {
    return {
      mood: 'waiting', handicap: 0.85,
      headline: 'The ghost stopped running',
      reason: `Three sessions this got away from you. That is a target problem, not a you problem — it has been lowered to something you can take today. Beat it and it starts climbing again.`,
    };
  }
  if (form.lossStreak === 2) {
    return {
      mood: 'waiting', handicap: 0.92,
      headline: 'The ghost is waiting for you',
      reason: `Two near misses in a row, so it backed off. This number is inside what you have already done. Go and take it.`,
    };
  }
  if (form.lossStreak === 1) {
    return {
      mood: 'measured', handicap: 0.98,
      headline: 'The ghost gave you a rematch',
      reason: `It shaved the target just under last week's. Same fight, slightly better odds.`,
    };
  }

  // Winning while your numbers slide means the target has been too soft, not
  // that you are ready for more. Nudge rather than pounce.
  if (form.winStreak >= 3 && form.trend === 'down') {
    return {
      mood: 'pressuring', handicap: 1.02,
      headline: 'The ghost is keeping pace',
      reason: `You keep winning, but your ${noun} has been drifting down. Small step up — get the numbers moving the right way before chasing a record.`,
    };
  }
  if (form.winStreak >= 3) {
    return {
      mood: 'hunting', handicap: 1.07,
      headline: 'The ghost is hunting',
      reason: `Three straight wins. It raised the bar ${noun === 'time' ? 'on your time' : `by about 7%`} — you have earned a harder fight, and this is how the next level gets found.`,
    };
  }
  if (form.winStreak === 2 || form.recentWins >= 2) {
    return {
      mood: 'pressuring', handicap: 1.04,
      headline: 'The ghost is pressuring you',
      reason: `You are on top of this lift. Small step up today — enough to matter, not enough to break form.`,
    };
  }
  if (form.trend === 'down') {
    return {
      mood: 'measured', handicap: 0.95,
      headline: 'The ghost noticed you are tired',
      reason: `Your last few sessions have drifted down. The target came down with them. Rebuild the base before chasing the record.`,
    };
  }

  return {
    mood: 'measured', handicap: 1.02,
    headline: 'The ghost is matching you',
    reason: `Just above your recent ${noun}. Beat it by one and the week counts as progress.`,
  };
}

/**
 * Build today's opponent for one exercise.
 */
export function readGhost(exercise: Exercise, context: GhostContext): GhostRead {
  const unit = unitFor(exercise);
  const usable = (context.history ?? []).filter(s => sessionScore(s, unit) > 0);
  const related = context.relatedHistory ?? [];
  const sets = Math.max(1, exercise.sets ?? 3);
  const patternLabel = context.patternLabel;

  if (usable.length === 0) {
    // Never trained *this* variation, so the plan sets the number. But if you
    // have been training the movement, the ghost arrives already knowing how
    // it has been going and adjusts the prescription accordingly.
    const firstUnit: ScoreUnit = unit === 'load' ? 'reps' : unit;
    const prescribed = prescribedScore(exercise, firstUnit);
    const momentum = readMomentum(related);
    const carries = related.length >= 2
      && (momentum.winStreak >= 2 || momentum.lossStreak >= 2);

    if (!carries) {
      return {
        target: prescribed,
        stretchTarget: Math.round(prescribed * 1.15),
        unit: firstUnit,
        mood: 'first_meeting',
        headline: 'First meeting',
        reason: `No history on this one yet, so the plan sets the bar: ${formatScore(prescribed, firstUnit)}. Whatever you log today becomes the ghost you race next time — log it honestly.`,
        perSetTarget: pace(prescribed, sets),
        baseline: prescribed,
        best: 0,
        handicap: 1,
        isFirstMeeting: true,
        sampleSize: 0,
      };
    }

    const carriedForm: Form = {
      baseline: prescribed, best: 0, trend: 'flat', daysSinceThisExercise: null, ...momentum,
    };
    const carriedDecision = decideMood(carriedForm, context.phase, firstUnit);
    const carriedTarget = Math.max(1, Math.round(prescribed * carriedDecision.handicap));
    const movement = patternLabel ?? 'this movement';
    const run = momentum.winStreak >= 2
      ? `${momentum.winStreak} straight wins on ${movement}`
      : `${momentum.lossStreak} tough sessions on ${movement}`;

    return {
      target: carriedTarget,
      stretchTarget: Math.round(carriedTarget * 1.15),
      unit: firstUnit,
      mood: carriedDecision.mood,
      headline: carriedDecision.headline,
      reason: `New variation, same job — so the ghost brought your record with it. ${run}, and it set today's bar from the plan adjusted for that. ${carriedDecision.reason}`,
      perSetTarget: pace(carriedTarget, sets),
      baseline: prescribed,
      best: 0,
      handicap: carriedDecision.handicap,
      isFirstMeeting: true,
      sampleSize: related.length,
      carriedFrom: movement,
    };
  }

  const form = readForm(usable, unit);

  // One or two sessions cannot establish a streak. Sibling variations can, and
  // a win is a win regardless of which variation earned it — so momentum is
  // merged chronologically until this lift has a sample of its own.
  const thin = usable.length < 3 && related.length > 0;
  if (thin) {
    const merged = [...usable, ...related].sort((a, b) => b.date - a.date);
    Object.assign(form, readMomentum(merged));
  }

  const decision = decideMood(form, context.phase, unit);

  const raw = form.baseline * decision.handicap;

  // Guard rails. The ghost may never ask for more than a modest step past your
  // best day, and may never sink so low that beating it means nothing.
  const ceiling = Math.round(form.best * 1.12);
  const floor = Math.max(1, Math.round(form.baseline * 0.7));
  const target = Math.max(floor, Math.min(ceiling || Math.round(raw), Math.round(raw)), 1);

  return {
    target,
    stretchTarget: Math.max(target + 1, Math.round(Math.max(form.best, target) * 1.08)),
    unit,
    mood: decision.mood,
    headline: decision.headline,
    reason: thin && patternLabel
      ? `${decision.reason} Momentum counted from your ${patternLabel} as a whole — you have only logged this variation ${usable.length === 1 ? 'once' : `${usable.length} times`}.`
      : decision.reason,
    perSetTarget: pace(target, sets),
    baseline: form.baseline,
    best: form.best,
    handicap: decision.handicap,
    isFirstMeeting: false,
    sampleSize: usable.length,
    carriedFrom: thin ? patternLabel : undefined,
  };
}

/**
 * The ghost's expected cumulative score after each set.
 *
 * Slightly front-loaded, because real sets decay: matching a flat average on
 * set one already means you are behind where you will finish.
 */
function pace(target: number, sets: number): number[] {
  if (sets <= 1) return [target];
  const out: number[] = [];
  let running = 0;
  // Weights descend gently — set one carries a little more than its even share.
  const total = Array.from({ length: sets }, (_, i) => 1 + (sets - 1 - i) * 0.08)
    .reduce((a, b) => a + b, 0);
  for (let i = 0; i < sets; i++) {
    running += (1 + (sets - 1 - i) * 0.08) / total;
    out.push(Math.round(target * running));
  }
  out[sets - 1] = target;
  return out;
}

// ─── Live commentary ─────────────────────────────────────────────────────────

export interface PaceRead {
  /** Ghost's expected score at this point in the session. */
  expected: number;
  ahead: boolean;
  /** Positive = you are up, negative = you are down. */
  delta: number;
  line: string;
}

/**
 * What the ghost says between sets. It is allowed to be blunt when you are
 * winning and is required to be useful when you are not.
 */
export function readPace(
  read: GhostRead,
  score: number,
  setsDone: number,
  totalSets: number,
): PaceRead {
  const idx = Math.min(Math.max(setsDone - 1, 0), read.perSetTarget.length - 1);
  const expected = setsDone <= 0 ? 0 : read.perSetTarget[idx];
  const delta = score - expected;
  const ahead = delta >= 0;
  const setsLeft = Math.max(0, totalSets - setsDone);
  const remaining = Math.max(0, read.target - score);

  if (setsDone === 0) {
    return { expected, ahead: true, delta: 0, line: `${formatScore(read.target, read.unit)} to beat. Set one sets the tone.` };
  }
  if (setsDone >= totalSets) {
    return {
      expected, ahead, delta,
      line: score >= read.target
        ? `Done — you cleared it by ${formatScore(Math.abs(score - read.target), read.unit)}.`
        : `${formatScore(remaining, read.unit)} short. Close one.`,
    };
  }

  if (!ahead) {
    const perSet = setsLeft > 0 ? Math.ceil(remaining / setsLeft) : remaining;
    return {
      expected, ahead, delta,
      line: `Down ${formatScore(Math.abs(delta), read.unit)}. ${setsLeft} ${setsLeft === 1 ? 'set' : 'sets'} left — ${formatScore(perSet, read.unit)} each takes it back.`,
    };
  }

  if (delta === 0) {
    return { expected, ahead, delta, line: `Dead level with the ghost. Next set decides it.` };
  }
  return {
    expected, ahead, delta,
    line: `Up ${formatScore(delta, read.unit)} on pace. Hold this and it is yours.`,
  };
}

/** The closing line, once the exercise is finished. */
export function verdictLine(read: GhostRead, score: number, isPr: boolean): string {
  if (isPr) return `Best you have ever done on this. The ghost just inherited a harder job.`;
  if (score >= read.stretchTarget) return `Well past the target. Expect it to come back angrier.`;
  if (score >= read.target) {
    return read.mood === 'waiting'
      ? `Taken. The ghost stops waiting now — the target goes back up next session.`
      : `Cleared by ${formatScore(score - read.target, read.unit)}. That counts.`;
  }
  const short = read.target - score;
  if (short <= Math.max(1, Math.round(read.target * 0.05))) {
    return `${formatScore(short, read.unit)} short — that is nothing. It drops the bar next time.`;
  }
  return `The ghost held this one. It will ease off next session; show up and take it back.`;
}
