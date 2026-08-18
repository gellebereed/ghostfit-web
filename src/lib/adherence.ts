/**
 * GhostFit — Comeback Orchestration
 *
 * Applies the verdict that [layoff.ts] reaches: rebuilds the plan, moves the
 * periodization clock, and handles the automatic weekly rollover. The
 * classification itself is kept pure and dependency-free next door.
 */
import { getCurrentPlan, getDaysSinceLastWorkout, getProfile, savePlan } from './db';
import { assessLayoff, type ComebackChoice, type LayoffAssessment } from './layoff';
import { buildProgram } from './program-engine';
import { getProgramState, resetProgramClock, saveProgramState } from './program-state';
import { getExperienceProfile } from './training-science';
import type { WorkoutPlan } from './types';

export { assessLayoff } from './layoff';
export type { ComebackChoice, ComebackOption, LayoffAssessment, LayoffLevel } from './layoff';

/** Read the user's real layoff from logged sessions. */
export async function getLayoffAssessment(): Promise<LayoffAssessment> {
  const days = await getDaysSinceLastWorkout();
  return assessLayoff(days);
}

/**
 * Should the comeback dialog open right now? Suppressed once the user has
 * answered for a gap of this size, and never re-asked more than daily.
 */
export function shouldShowComeback(assessment: LayoffAssessment): boolean {
  if (!assessment.shouldPrompt) return false;
  const state = getProgramState();
  if (assessment.daysAway <= state.lastLayoffHandledDays) return false;
  if (Date.now() - state.lastLayoffPromptAt < 20 * 60 * 60 * 1000) return false;
  return true;
}

export function markComebackPrompted(assessment: LayoffAssessment): void {
  saveProgramState({ lastLayoffPromptAt: Date.now() });
  void assessment;
}

/**
 * Apply the user's answer: rebuild and persist the plan, and move the
 * periodization clock to match.
 */
export async function applyComebackChoice(
  choice: ComebackChoice,
  assessment: LayoffAssessment,
): Promise<WorkoutPlan | null> {
  const state = getProgramState();

  if (choice === 'keep') {
    saveProgramState({ lastLayoffHandledDays: assessment.daysAway, lastLayoffPromptAt: Date.now() });
    return null;
  }

  const profile = await getProfile();
  const equipment = profile?.equipment?.length ? profile.equipment : ['Bodyweight Only'];
  const goal = profile?.goal || 'fitness';

  let programWeek = state.programWeek;
  let phase: 'reentry' | undefined;

  if (choice === 'restart') {
    programWeek = 1;
    phase = undefined;
  } else if (choice === 'reentry') {
    // Drop back to the start of the current mesocycle so the volume ramp is
    // re-earned rather than resumed mid-climb.
    const { mesocycleLength } = getExperienceProfile(state.experience);
    programWeek = Math.max(1, programWeek - ((programWeek - 1) % mesocycleLength));
    phase = 'reentry';
  }

  const plan = buildProgram({
    equipment,
    goal,
    experience: state.experience,
    trainingDays: state.trainingDays,
    trainingDayIndices: state.trainingDayIndices ?? undefined,
    sessionMinutes: state.sessionMinutes,
    programWeek,
    phase,
    reentryFromDaysOff: assessment.daysAway,
  });

  await savePlan(plan);

  if (choice === 'restart') {
    resetProgramClock(null);
  }
  saveProgramState({
    programWeek,
    weekStartedAt: Date.now(),
    phaseOverride: phase ?? null,
    lastLayoffHandledDays: assessment.daysAway,
    lastLayoffPromptAt: Date.now(),
  });

  return plan;
}

/**
 * Weekly rollover. Once the active plan is seven days old and the user has not
 * been away long enough to need a comeback, the next week of the mesocycle is
 * generated automatically — volume ramps, the deload lands on schedule, and
 * the user never has to press "regenerate" to keep progressing.
 */
export async function maybeAdvanceWeek(): Promise<WorkoutPlan | null> {
  const state = getProgramState();
  const plan = await getCurrentPlan();
  if (!plan) return null;

  // Only the engine's own plans carry a mesocycle position to advance.
  if (!plan.meta) return null;

  const anchor = state.weekStartedAt || plan.createdAt;
  if (Date.now() - anchor < 7 * 86400000) return null;

  const days = await getDaysSinceLastWorkout();
  // A long absence is the comeback engine's call, not the rollover's.
  if (days !== null && days > 7) return null;

  const profile = await getProfile();
  const equipment = profile?.equipment?.length ? profile.equipment : ['Bodyweight Only'];
  const nextWeek = state.programWeek + 1;

  const next = buildProgram({
    equipment,
    goal: profile?.goal || 'fitness',
    experience: state.experience,
    trainingDays: state.trainingDays,
    trainingDayIndices: state.trainingDayIndices ?? undefined,
    sessionMinutes: state.sessionMinutes,
    programWeek: nextWeek,
  });

  await savePlan(next);
  saveProgramState({ programWeek: nextWeek, weekStartedAt: Date.now(), phaseOverride: null });
  return next;
}
