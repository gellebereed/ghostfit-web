/**
 * GhostFit — Program Engine
 *
 * Deterministic, offline, evidence-led plan generation. Given the same inputs
 * it always builds the same week, so a user's plan never silently reshuffles
 * and progression stays trackable across a mesocycle.
 *
 * Pipeline: pick the split → lay sessions on the calendar → fill each slot
 * from the exercise library → apply the goal's set/rep/rest/RIR prescription
 * scaled by experience and where the week sits in the mesocycle → trim to the
 * time budget → bolt on a RAMP warm-up and a targeted cool-down → audit the
 * weekly volume.
 */
import { buildCooldown, buildRestDayFlow, buildWarmup, totalCooldownSeconds, totalWarmupSeconds } from './mobility-library';
import { availableExercises, displayEquipment, type LibraryExercise } from './exercise-library';
import {
  FOCUS_FREQUENCY_META, getFocusArea, normalizeFocusFrequency,
  type FocusArea, type FocusAreaId, type FocusFrequency,
} from './focus-library';
import {
  AUDITED_MUSCLES, ENGINE_VERSION, exerciseSeconds, getExperienceProfile, getGoalProfile,
  minimumSets, normalizeExperience, periodize, progressionCue, roundTo, SESSION_TEMPLATES,
  selectSplit, clampRir,
  type BlockPrescription, type SessionTemplate, type Slot,
} from './training-science';
import type {
  Exercise, ExperienceLevel, MovementPattern, MuscleGroup, PlanMeta,
  TrainingPhase, WorkoutDay, WorkoutPlan,
} from './types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface ProgramInput {
  equipment: string[];
  goal: string;
  experience?: string;
  trainingDays?: number;
  sessionMinutes?: number;
  /** Absolute week of the user's program — drives periodization. */
  programWeek?: number;
  /** Forces a phase, e.g. 'reentry' after a layoff. */
  phase?: TrainingPhase;
  /** Day of week the plan starts on (0 = Sunday). Defaults to today. */
  startDayIndex?: number;
  /**
   * Exact weekdays the user trains (0 = Sunday). When supplied this wins over
   * `trainingDays` and over the split's default spacing — someone who can only
   * train Tuesday, Thursday and Sunday needs those days, not "well spaced".
   */
  trainingDayIndices?: number[];
  /** Days off that triggered a rebuild — recorded in the plan meta. */
  reentryFromDaysOff?: number;
  /** Body part to specialize in, on top of the normal split. */
  focusArea?: FocusAreaId | null;
  /** How many sessions a week carry the focus block. */
  focusFrequency?: FocusFrequency;
}

// ─── Exercise selection ──────────────────────────────────────────────────────

/** Slots asking for a compound want the biggest lift available, and vice versa. */
function scoreCandidate(candidate: LibraryExercise, slot: Slot, experience: ExperienceLevel): number {
  let score = 0;
  const wantsCompound = slot.block === 'primary' || slot.block === 'secondary';

  // Weighted heavily: a prehab drill standing in for a main lift is a worse
  // outcome than repeating a lift the user already did earlier in the week.
  if (wantsCompound === candidate.compound) score += 20;
  if (slot.muscle && candidate.primary.includes(slot.muscle)) score += 10;
  if (slot.muscle && !candidate.primary.includes(slot.muscle)) score -= 8;

  // Loadable lifts win for primary work — you cannot add weight to a push-up.
  if (wantsCompound && candidate.metricType === 'weight_reps') score += 6;
  if (slot.block === 'primary' && candidate.taxing) score += 3;

  // Match difficulty to the trainee rather than always handing out the hardest.
  const wanted = experience === 'beginner' ? 1 : experience === 'intermediate' ? 2 : 3;
  score -= Math.abs(candidate.level - wanted) * 3;

  return score;
}

interface Picker {
  used: Set<string>;
  usedThisWeek: Map<string, number>;
  rotation: number;
  equipment: string[];
  experience: ExperienceLevel;
}

function pickExercise(picker: Picker, slot: Slot, taxingBudget: { left: number }): LibraryExercise | null {
  const pool = availableExercises(picker.equipment, picker.experience, slot.pattern)
    .filter(e => !picker.used.has(e.id))
    .filter(e => !e.taxing || taxingBudget.left > 0);

  if (pool.length === 0) return null;

  const ranked = pool
    .map(e => ({
      e,
      score:
        scoreCandidate(e, slot, picker.experience) -
        // Spread work across the week — but not so hard that a limited
        // equipment list forces a downgrade rather than a repeat.
        (picker.usedThisWeek.get(e.id) ?? 0) * 8,
    }))
    .sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id));

  // Rotate between mesocycles so the program varies block to block, but stays
  // fixed inside a block — you cannot progress a lift you keep swapping out.
  const top = ranked.slice(0, Math.min(3, ranked.length));
  const chosen = top[picker.rotation % top.length].e;

  picker.used.add(chosen.id);
  picker.usedThisWeek.set(chosen.id, (picker.usedThisWeek.get(chosen.id) ?? 0) + 1);
  if (chosen.taxing) taxingBudget.left -= 1;
  return chosen;
}

// ─── Prescription ────────────────────────────────────────────────────────────

interface PrescriptionContext {
  prescription: BlockPrescription;
  volumeMultiplier: number;
  intensityMultiplier: number;
  rirOffset: number;
  volumeScale: number;
  isDeload: boolean;
}

function buildExercise(
  lib: LibraryExercise,
  slot: Slot,
  ctx: PrescriptionContext,
  supersetGroup?: string,
): Exercise {
  const p = ctx.prescription;
  const rawSets = p.sets * ctx.volumeScale * ctx.volumeMultiplier;
  const sets = Math.max(minimumSets(slot.block, ctx.isDeload), Math.round(rawSets));

  const isCardio = lib.metricType === 'cardio';
  const isHold = lib.metricType === 'duration';

  const base: Exercise = {
    name: lib.name,
    sets: isCardio ? 1 : sets,
    reps: 0,
    equipment: displayEquipment(lib),
    type: lib.type,
    metricType: lib.metricType,
    durationSeconds: null,
    libraryId: lib.id,
    restSeconds: roundTo(p.restSeconds * (ctx.isDeload ? 0.9 : 1), 5),
    targetRir: clampRir(p.rir + ctx.rirOffset),
    tempo: isCardio || isHold ? undefined : p.tempo,
    movementPattern: lib.pattern,
    primaryMuscles: lib.primary,
    secondaryMuscles: lib.secondary,
    block: slot.block,
    coachNote: lib.cue,
    supersetGroup,
  };

  if (isCardio) {
    const seconds = roundTo((lib.defaultSeconds ?? 900) * ctx.intensityMultiplier, 60);
    return { ...base, durationSeconds: Math.max(300, seconds), restSeconds: 0, targetRir: undefined, tempo: undefined };
  }

  if (isHold) {
    const seconds = roundTo((lib.defaultSeconds ?? 30) * ctx.intensityMultiplier, 5);
    return { ...base, durationSeconds: Math.max(15, seconds), repMin: undefined, repMax: undefined };
  }

  // Unilateral work is prescribed per side, so the rep target is per side too.
  const repMin = p.repMin;
  const repMax = p.repMax;
  return { ...base, reps: repMin, repMin, repMax };
}

function exerciseCost(ex: Exercise): number {
  if (ex.metricType === 'cardio') return (ex.durationSeconds ?? 900) + 60;
  if (ex.metricType === 'duration') {
    return ex.sets * ((ex.durationSeconds ?? 30) + (ex.restSeconds ?? 45));
  }
  return exerciseSeconds(ex.sets, ex.repMax ?? ex.reps ?? 10, ex.restSeconds ?? 60, ex.tempo ?? '2-0-1-0');
}

// ─── Session assembly ────────────────────────────────────────────────────────

interface SessionBuild {
  exercises: Exercise[];
  patterns: MovementPattern[];
  muscles: MuscleGroup[];
  seconds: number;
}

function buildSession(
  template: SessionTemplate,
  picker: Picker,
  goalId: string,
  ctx: Omit<PrescriptionContext, 'prescription'>,
  budgetSeconds: number,
  maxExercises: number,
  maxTaxing: number,
): SessionBuild {
  const goal = getGoalProfile(goalId);
  const taxingBudget = { left: maxTaxing };
  picker.used = new Set();

  interface Built { exercise: Exercise; slot: Slot; lib: LibraryExercise; cost: number }
  const built: Built[] = [];

  // A deload cuts work; it must never quietly add exercises just because the
  // lower set counts freed up room in the time budget.
  const slots = ctx.isDeload
    ? template.slots.filter(s => s.priority <= 2)
    : template.slots;

  for (const slot of slots) {
    if (built.length >= maxExercises) break;
    const lib = pickExercise(picker, slot, taxingBudget);
    if (!lib) continue;
    const prescription = goal.blocks[slot.block];
    const exercise = buildExercise(lib, slot, { ...ctx, prescription });
    built.push({ exercise, slot, lib, cost: exerciseCost(exercise) });
  }

  // Trim to the time budget, dropping the least important work first.
  const trimmed = [...built];
  const total = () => trimmed.reduce((sum, b) => sum + b.cost, 0);
  while (trimmed.length > 3 && total() > budgetSeconds) {
    let dropIdx = -1;
    let worst = -Infinity;
    trimmed.forEach((b, i) => {
      if (b.slot.priority > worst) { worst = b.slot.priority; dropIdx = i; }
    });
    if (dropIdx < 0 || worst <= 1) break;
    trimmed.splice(dropIdx, 1);
  }

  // Density trick for fat-loss work: pair the accessories so short rests are
  // spent doing something useful instead of standing still.
  if (goal.supersetAccessories) {
    const accessories = trimmed.filter(b => b.slot.block === 'accessory');
    for (let i = 0; i + 1 < accessories.length; i += 2) {
      const tag = `ss${i / 2 + 1}`;
      accessories[i].exercise.supersetGroup = tag;
      accessories[i + 1].exercise.supersetGroup = tag;
    }
  }

  const exercises = trimmed.map(b => b.exercise);
  const patterns = [...new Set(trimmed.map(b => b.slot.pattern))];
  const muscles: MuscleGroup[] = [];
  trimmed.forEach(b => {
    b.lib.primary.forEach(m => { if (!muscles.includes(m)) muscles.push(m); });
  });
  trimmed.forEach(b => {
    b.lib.secondary.forEach(m => { if (!muscles.includes(m)) muscles.push(m); });
  });

  return { exercises, patterns, muscles, seconds: total() };
}

// ─── Conditioning ────────────────────────────────────────────────────────────

function conditioningExercise(
  equipment: string[],
  experience: ExperienceLevel,
  seconds: number,
  rotation: number,
): Exercise | null {
  const pool = availableExercises(equipment, experience, 'conditioning');
  if (pool.length === 0) return null;

  // Owning a rower or a rope and being handed burpees is the kind of detail
  // that makes a plan feel generated rather than programmed. Machines and
  // timed modalities win outright whenever the user has one; only when they
  // have none do we rotate through bodyweight conditioning.
  const timed = pool.filter(e => e.metricType === 'cardio').sort((a, b) => a.id.localeCompare(b.id));
  const ranked = (timed.length ? timed : [...pool].sort((a, b) => a.id.localeCompare(b.id)));
  const lib = ranked[rotation % ranked.length];

  if (lib.metricType === 'cardio') {
    return {
      name: lib.name, sets: 1, reps: 0, equipment: displayEquipment(lib),
      type: 'cardio', metricType: 'cardio',
      durationSeconds: Math.max(300, roundTo(seconds, 60)),
      libraryId: lib.id, restSeconds: 0, block: 'conditioning',
      movementPattern: 'conditioning', primaryMuscles: lib.primary, secondaryMuscles: lib.secondary,
      coachNote: lib.cue,
    };
  }
  return {
    name: lib.name, sets: 4, reps: 15, repMin: 12, repMax: 20,
    equipment: displayEquipment(lib), type: 'strength', metricType: lib.metricType,
    durationSeconds: null, libraryId: lib.id, restSeconds: 45, block: 'conditioning',
    movementPattern: 'conditioning', primaryMuscles: lib.primary, secondaryMuscles: lib.secondary,
    coachNote: lib.cue, targetRir: 1,
  };
}

// ─── Focus block ─────────────────────────────────────────────────────────────

/**
 * Build the specialization block for one session.
 *
 * Takes at most one exercise per role so the block covers complementary jobs
 * instead of stacking near-identical movements, and skips anything the session
 * already programmed — being handed a lat pulldown twice because you chose a
 * back focus on pull day is exactly the kind of thing that erodes trust.
 *
 * `rotation` walks the role list on non-core roles so the third slot varies
 * between sessions rather than being the same movement all week.
 */
function buildFocusBlock(
  area: FocusArea,
  equipment: string[],
  experience: ExperienceLevel,
  goalId: string,
  ctx: Omit<PrescriptionContext, 'prescription'>,
  alreadyUsed: Set<string>,
  slotCount: number,
  rotation: number,
): { exercises: Exercise[]; seconds: number } {
  const prescription = getGoalProfile(goalId).blocks.focus;
  const pool = new Map(
    availableExercises(equipment, experience).map(e => [e.id, e]),
  );

  const coreRoles = area.roles.filter(r => r.core);
  const extraRoles = area.roles.filter(r => !r.core);

  // With room for every core role, all of them are fixed and only the extras
  // rotate — the staple pairing shows up on every focus session.
  //
  // With fewer slots than core roles (high frequency cuts the block to one
  // exercise), the core roles themselves rotate instead. Otherwise the first
  // role would win every session and the other half of the muscle would never
  // get trained at all — which is the opposite of specializing in it.
  const ordered = slotCount >= coreRoles.length
    ? [...coreRoles, ...rotateFrom(extraRoles, rotation)]
    : [...rotateFrom(coreRoles, rotation), ...extraRoles];

  const exercises: Exercise[] = [];
  let seconds = 0;

  for (const role of ordered) {
    if (exercises.length >= slotCount) break;
    const lib = role.candidates
      .map(id => pool.get(id))
      .find((e): e is LibraryExercise => !!e && !alreadyUsed.has(e.id));
    if (!lib) continue;

    alreadyUsed.add(lib.id);
    const slot: Slot = { pattern: lib.pattern, block: 'focus', priority: 3 };
    const exercise = buildExercise(lib, slot, { ...ctx, prescription });
    exercises.push({ ...exercise, coachNote: `${area.label} focus · ${role.label}. ${lib.cue}` });
    seconds += exerciseCost(exercise);
  }

  return { exercises, seconds };
}

function rotateFrom<T>(items: T[], by: number): T[] {
  if (items.length <= 1) return items;
  const offset = ((by % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

/**
 * Which training days carry the focus block, spread as evenly as the week
 * allows. Consecutive focus days are the thing to avoid — the same small
 * muscle worked two days running is where specialization stops paying.
 */
function selectFocusOffsets(spacing: number[], maxSessions: number): Set<number> {
  if (spacing.length === 0 || maxSessions <= 0) return new Set();
  if (maxSessions >= spacing.length) return new Set(spacing);

  const step = spacing.length / maxSessions;
  const chosen = new Set<number>();
  for (let i = 0; i < maxSessions; i++) chosen.add(spacing[Math.floor(i * step)]);
  return chosen;
}

// ─── Volume audit ────────────────────────────────────────────────────────────

function auditWeeklySets(days: WorkoutDay[]): Partial<Record<MuscleGroup, number>> {
  const tally: Partial<Record<MuscleGroup, number>> = {};
  for (const day of days) {
    for (const ex of day.exercises) {
      if (ex.type === 'cardio') continue;
      const sets = ex.sets ?? 0;
      (ex.primaryMuscles ?? []).forEach(m => { tally[m] = (tally[m] ?? 0) + sets; });
      // Secondary movers get half credit — they work, but not as the limiter.
      (ex.secondaryMuscles ?? []).forEach(m => { tally[m] = (tally[m] ?? 0) + sets * 0.5; });
    }
  }
  AUDITED_MUSCLES.forEach(m => {
    if (tally[m] !== undefined) tally[m] = Math.round(tally[m]! * 10) / 10;
  });
  return tally;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function buildProgram(input: ProgramInput): WorkoutPlan {
  const equipment = input.equipment?.length ? input.equipment : ['Bodyweight Only'];
  const experience = normalizeExperience(input.experience);
  const goalProfile = getGoalProfile(input.goal);
  const chosenDays = normalizeDayIndices(input.trainingDayIndices);
  const trainingDays = chosenDays
    ? chosenDays.length
    : Math.max(2, Math.min(6, Math.round(input.trainingDays ?? 3)));
  const sessionMinutes = Math.max(20, Math.min(120, Math.round(input.sessionMinutes ?? 45)));
  const programWeek = Math.max(1, Math.round(input.programWeek ?? 1));

  const expProfile = getExperienceProfile(experience);
  const cycle = periodize(programWeek, experience, { phase: input.phase });
  const split = selectSplit(trainingDays, experience, goalProfile.id);

  const startDay = input.startDayIndex ?? new Date().getDay();
  // Offsets are measured from day 1 of the plan, which is always today.
  const spacing = chosenDays
    ? chosenDays.map(d => (d - startDay + 7) % 7).sort((a, b) => a - b)
    : split.spacing;
  const trainingOffsets = new Set(spacing);

  const picker: Picker = {
    used: new Set(),
    usedThisWeek: new Map(),
    // Exercises hold steady inside a mesocycle and rotate between them.
    rotation: Math.floor((programWeek - 1) / cycle.mesocycleLength),
    equipment,
    experience,
  };

  const ctx = {
    volumeMultiplier: cycle.volumeMultiplier,
    intensityMultiplier: cycle.intensityMultiplier,
    rirOffset: cycle.rirOffset + expProfile.rirOffset,
    volumeScale: expProfile.volumeScale,
    isDeload: cycle.isDeload,
  };

  // Reserve time for the warm-up and cool-down instead of pretending they are free.
  const overheadMinutes = sessionMinutes <= 30 ? 8 : sessionMinutes <= 45 ? 10 : 12;
  const liftingBudget = Math.max(600, (sessionMinutes - overheadMinutes) * 60);

  // Conditioning days are chosen before the sessions are built, and their
  // lifting budget is reduced up front. Deciding afterwards meant a dense
  // fat-loss program could fill every minute with lifting and then have no
  // room left for the cardio the goal is actually built around.
  const conditioningCount = cycle.isDeload ? 0 : goalProfile.conditioningSessions;
  const conditioningOffsets = new Set(
    // Spread them out: take from the end of the week backwards, every other day.
    spacing.slice().reverse().filter((_, i) => i % 2 === 0).slice(0, conditioningCount),
  );
  const conditioningReserve = Math.min(goalProfile.conditioningSeconds, 900) + 60;

  const sessions = new Map<number, SessionBuild & { template: SessionTemplate }>();
  spacing.forEach((offset, i) => {
    const template = SESSION_TEMPLATES[split.sequence[i % split.sequence.length]];
    const budget = conditioningOffsets.has(offset)
      ? Math.max(600, liftingBudget - conditioningReserve)
      : liftingBudget;
    const build = buildSession(
      template, picker, goalProfile.id, ctx, budget,
      expProfile.maxExercises, cycle.isDeload ? 1 : expProfile.maxTaxing,
    );
    sessions.set(offset, { ...build, template });
  });

  // Specialization goes on after the session is built, so it can never push
  // out the programmed work — it is extra, by the user's explicit choice.
  // A deload skips it: the point of a deload is less total work.
  const focusArea = getFocusArea(input.focusArea);
  const focusFrequency = normalizeFocusFrequency(input.focusFrequency);
  const focusOffsets = focusArea && !cycle.isDeload
    ? selectFocusOffsets(spacing, FOCUS_FREQUENCY_META[focusFrequency].maxSessions)
    : new Set<number>();

  if (focusArea) {
    // Training a body part six days a week is more than most people recover
    // from, so the per-session slot count drops as frequency rises. Weekly
    // volume still climbs; it just climbs sanely.
    const perSession = focusFrequency === 'every' && focusOffsets.size > 3
      ? 1
      : FOCUS_FREQUENCY_META[focusFrequency].exercisesPerSession;

    let focusRotation = picker.rotation;
    for (const offset of [...focusOffsets]) {
      const session = sessions.get(offset);
      if (!session) continue;
      const { exercises, seconds } = buildFocusBlock(
        focusArea, equipment, experience, goalProfile.id, ctx,
        new Set(session.exercises.map(e => e.libraryId).filter((id): id is string => !!id)),
        perSession, focusRotation++,
      );
      // The user's equipment may not support this area at all — a back focus on
      // pure bodyweight has nothing to offer. Drop the day from the count so
      // the plan never claims focus sessions it did not actually program.
      if (exercises.length === 0) {
        focusOffsets.delete(offset);
        continue;
      }
      session.exercises.push(...exercises);
      session.seconds += seconds;
      focusArea.muscles.forEach(m => { if (!session.muscles.includes(m)) session.muscles.push(m); });
      sessions.set(offset, session);
    }
  }

  let conditioningIndex = 0;
  for (const offset of conditioningOffsets) {
    const session = sessions.get(offset);
    if (!session) continue;
    const remaining = liftingBudget - session.seconds;
    if (remaining < 360) continue;
    const cardio = conditioningExercise(
      equipment, experience,
      Math.min(goalProfile.conditioningSeconds, remaining - 60),
      picker.rotation + conditioningIndex++,
    );
    if (!cardio) continue;
    session.exercises.push(cardio);
    session.seconds += exerciseCost(cardio);
    if (!session.muscles.includes('heart')) session.muscles.push('heart');
    sessions.set(offset, session);
  }

  const days: WorkoutDay[] = Array.from({ length: 7 }, (_, offset) => {
    const dayName = DAY_NAMES[(startDay + offset) % 7];
    const session = sessions.get(offset);

    if (!session || !trainingOffsets.has(offset)) {
      return {
        dayNumber: offset + 1,
        dayName,
        focus: 'Recovery',
        isRest: true,
        exercises: [],
        sessionType: 'rest',
        warmup: [],
        cooldown: buildRestDayFlow(),
        estimatedMinutes: 12,
        intensityLabel: 'Light',
        targetMuscles: [],
        coachNote: 'Not a wasted day — this is when the work you already did turns into muscle. Walk, sleep, eat protein, run the mobility flow below.',
      };
    }

    const { template, exercises, patterns, muscles } = session;
    const warmup = buildWarmup(patterns, equipment, sessionMinutes, exercises[0]?.name);
    const cooldown = buildCooldown(muscles, sessionMinutes, {
      intense: template.intensityLabel === 'Heavy' && !cycle.isDeload,
    });
    const estimatedMinutes = Math.round(
      (session.seconds + totalWarmupSeconds(warmup) + totalCooldownSeconds(cooldown)) / 60,
    );

    return {
      dayNumber: offset + 1,
      dayName,
      focus: cycle.isDeload ? `${template.focus} (Deload)` : template.focus,
      isRest: false,
      exercises,
      sessionType: template.sessionType,
      warmup,
      cooldown,
      estimatedMinutes,
      intensityLabel: cycle.isDeload ? 'Light' : template.intensityLabel,
      targetMuscles: muscles,
      coachNote: sessionNote(template, cycle.phase),
    };
  });

  const weeklySets = auditWeeklySets(days);
  const meta: PlanMeta = {
    engineVersion: ENGINE_VERSION,
    splitId: split.id,
    splitName: split.name,
    splitRationale: split.rationale,
    goal: goalProfile.id,
    experience,
    trainingDays,
    sessionMinutes,
    mesocycleWeek: cycle.mesocycleWeek,
    mesocycleLength: cycle.mesocycleLength,
    phase: cycle.phase,
    isDeload: cycle.isDeload,
    volumeMultiplier: cycle.volumeMultiplier,
    intensityMultiplier: cycle.intensityMultiplier,
    weeklySets,
    coachNotes: buildCoachNotes(
      cycle.note, split.rationale, goalProfile.summary, weeklySets, goalProfile.weeklySetTarget,
      focusArea ? { area: focusArea, frequency: focusFrequency, sessions: focusOffsets.size } : null,
    ),
    reentryFromDaysOff: input.reentryFromDaysOff,
    trainingDayIndices: chosenDays ?? undefined,
    focus: focusArea
      ? {
          area: focusArea.id,
          label: focusArea.label,
          frequency: focusFrequency,
          sessions: focusOffsets.size,
        }
      : undefined,
  };

  return { weekNumber: programWeek, days, createdAt: Date.now(), meta };
}

/** Deduplicate, clamp to 0-6, sort, and reject a selection we cannot program. */
function normalizeDayIndices(days: number[] | undefined): number[] | null {
  if (!days?.length) return null;
  const clean = [...new Set(days.map(d => Math.floor(d)).filter(d => d >= 0 && d <= 6))].sort((a, b) => a - b);
  // Below two days there is no split worth the name; above six there is no rest.
  return clean.length >= 2 && clean.length <= 6 ? clean : null;
}

function sessionNote(template: SessionTemplate, phase: TrainingPhase): string {
  if (phase === 'deload') return 'Deload session. Same movements, half the sets. Leave feeling fresher than you arrived.';
  if (phase === 'reentry') return 'Coming back. Stop every set well short of failure — the goal today is showing up, not soreness.';
  if (template.sessionType === 'conditioning') return 'Conditioning day. Keep the effort honest and the form clean when you get tired.';
  return template.intensityLabel === 'Heavy'
    ? 'The first two lifts are the session. Give them your best effort before fatigue arrives.'
    : 'Moderate day by design. Move well, control the tempo, bank the volume.';
}

function buildCoachNotes(
  cycleNote: string,
  splitRationale: string,
  goalSummary: string,
  weeklySets: Partial<Record<MuscleGroup, number>>,
  target: number,
  focus: { area: FocusArea; frequency: FocusFrequency; sessions: number } | null,
): string[] {
  const notes = [cycleNote, splitRationale, goalSummary];
  if (focus && focus.sessions === 0) {
    notes.push(
      `${focus.area.label} focus is on, but nothing in your equipment list can train it directly — add the gear it needs, or pick another focus.`,
    );
  } else if (focus) {
    const cadence = FOCUS_FREQUENCY_META[focus.frequency].label.toLowerCase();
    notes.push(
      `${focus.area.label} focus (${cadence}): extra work on ${focus.sessions} of your ${focus.sessions === 1 ? 'session' : 'sessions'}. ${focus.area.rationale}`,
    );
    notes.push(focus.area.reality);
  }
  const low = AUDITED_MUSCLES.filter(m => (weeklySets[m] ?? 0) > 0 && (weeklySets[m] ?? 0) < target * 0.5);
  if (low.length > 0 && low.length <= 4) {
    notes.push(
      `Light on ${low.join(', ')} this week — your equipment limits the options. Add a set there if you finish early.`,
    );
  }
  return notes;
}

export { progressionCue };
