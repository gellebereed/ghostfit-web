/**
 * GhostFit — Plan Actions
 *
 * One entry point for "build me a plan and save it". The engine is pure and
 * runs on the device, so regeneration is instant and works offline — no API
 * key, no spinner waiting on a model, no chance of a malformed week.
 */
import { savePlan } from './db';
import { buildProgram } from './program-engine';
import { getProgramState, resetProgramClock, saveProgramState } from './program-state';
import { normalizeExperience } from './training-science';
import type { FocusAreaId, FocusFrequency } from './focus-library';
import type { TrainingPhase, WorkoutPlan } from './types';

export interface GeneratePlanOptions {
  equipment: string[];
  goal: string;
  experience?: string;
  trainingDays?: number;
  /** Exact weekdays to train (0 = Sunday). Overrides trainingDays. */
  trainingDayIndices?: number[] | null;
  sessionMinutes?: number;
  /** Body part to specialize in. Pass null to clear it. */
  focusArea?: FocusAreaId | null;
  focusFrequency?: FocusFrequency;
  /** Start a brand-new mesocycle at week 1 (goal or equipment changed). */
  restartCycle?: boolean;
  phase?: TrainingPhase;
}

/**
 * Build the current week and persist it. Training preferences passed in are
 * remembered, so later automatic rebuilds use the same rhythm.
 */
export async function generateAndSavePlan(options: GeneratePlanOptions): Promise<WorkoutPlan> {
  const state = getProgramState();
  const experience = normalizeExperience(options.experience ?? state.experience);
  const trainingDayIndices = options.trainingDayIndices !== undefined
    ? options.trainingDayIndices
    : state.trainingDayIndices;
  const trainingDays = trainingDayIndices?.length ?? options.trainingDays ?? state.trainingDays;
  const sessionMinutes = options.sessionMinutes ?? state.sessionMinutes;
  const focusArea = options.focusArea !== undefined ? options.focusArea : state.focusArea;
  const focusFrequency = options.focusFrequency ?? state.focusFrequency;

  // Changing goal or equipment invalidates the progression — start the ramp
  // again rather than dropping the user into week 3 of a program they never ran.
  const programWeek = options.restartCycle ? 1 : state.programWeek;

  const plan = buildProgram({
    equipment: options.equipment,
    goal: options.goal,
    experience,
    trainingDays,
    trainingDayIndices: trainingDayIndices ?? undefined,
    sessionMinutes,
    programWeek,
    focusArea,
    focusFrequency,
    phase: options.phase ?? state.phaseOverride ?? undefined,
    startDayIndex: new Date().getDay(),
  });

  await savePlan(plan);

  if (options.restartCycle) {
    resetProgramClock(options.phase ?? null);
    saveProgramState({ experience, trainingDays, trainingDayIndices, sessionMinutes, focusArea, focusFrequency });
  } else {
    saveProgramState({
      experience,
      trainingDays,
      trainingDayIndices,
      sessionMinutes,
      focusArea,
      focusFrequency,
      weekStartedAt: Date.now(),
    });
  }

  return plan;
}
