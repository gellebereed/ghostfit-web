/**
 * GhostFit — Layoff Classification
 *
 * Life interrupts training. This module decides what a plan should do about
 * it — pure, dependency-free, and therefore reasonable about in isolation.
 * [adherence.ts] applies the verdict.
 *
 * The thresholds come from the detraining literature: strength is largely
 * retained for two to three weeks off, meaningful losses start around four,
 * and cardiovascular fitness fades faster than strength. The bigger practical
 * risk on return is not lost muscle but lost tolerance — the repeated-bout
 * effect wears off after roughly four to six weeks, so the first session back
 * at full volume buys a week of crippling soreness and another missed week.
 * Every recommendation below is therefore biased toward under-loading the
 * return and rebuilding fast, rather than picking up where you left off.
 */
export type LayoffLevel = 'none' | 'slipping' | 'missed_week' | 'detraining' | 'reset';

export type ComebackChoice =
  /** Keep the program, just re-anchor the week to today. */
  | 'resync'
  /** One deliberately easy week at reduced volume, then resume. */
  | 'reentry'
  /** Back to week 1 of a fresh mesocycle. */
  | 'restart'
  /** Change nothing. */
  | 'keep';

export interface ComebackOption {
  id: ComebackChoice;
  label: string;
  detail: string;
  recommended: boolean;
}

export interface LayoffAssessment {
  level: LayoffLevel;
  daysAway: number;
  /** True when the user should be asked what to do. */
  shouldPrompt: boolean;
  headline: string;
  explanation: string;
  /** What the science says has actually changed. */
  physiology: string;
  recommended: ComebackChoice;
  options: ComebackOption[];
}

const OPTION_COPY: Record<ComebackChoice, { label: string; detail: string }> = {
  resync: {
    label: 'Re-sync my week',
    detail: 'Same program, same difficulty — the schedule just moves so today is day one again.',
  },
  reentry: {
    label: 'Ease me back in',
    detail: 'One re-entry week at about 60% volume and lighter loads, then straight back to normal progression.',
  },
  restart: {
    label: 'Start fresh',
    detail: 'A brand-new week 1. Volume rebuilds from the bottom over the next four weeks.',
  },
  keep: {
    label: 'Leave it alone',
    detail: 'Keep the current plan exactly as it is. You know your body.',
  },
};

function option(id: ComebackChoice, recommended: boolean): ComebackOption {
  return { id, ...OPTION_COPY[id], recommended };
}

/**
 * Classify a layoff. Pure — takes the number of days and returns the verdict,
 * so it can be unit-reasoned about without touching the database.
 */
export function assessLayoff(daysAway: number | null): LayoffAssessment {
  const days = daysAway ?? 0;

  if (daysAway === null || days <= 3) {
    return {
      level: 'none', daysAway: days, shouldPrompt: false,
      headline: 'On track',
      explanation: 'No meaningful gap. Carry on.',
      physiology: 'Nothing has changed — under four days off, performance is unaffected.',
      recommended: 'keep',
      options: [option('keep', true)],
    };
  }

  if (days <= 7) {
    return {
      level: 'slipping', daysAway: days, shouldPrompt: true,
      headline: `${days} days since your last session`,
      explanation: 'Your plan is now out of step with the calendar. Re-syncing puts today back at the front of the week so you are not staring at a Tuesday workout on a Friday.',
      physiology: 'Under a week off costs you nothing physically. Strength and muscle are fully retained — the only thing that has slipped is the schedule.',
      recommended: 'resync',
      options: [option('resync', true), option('keep', false)],
    };
  }

  if (days <= 14) {
    return {
      level: 'missed_week', daysAway: days, shouldPrompt: true,
      headline: `${days} days off — about two weeks`,
      explanation: 'One easy week back is the fastest route to where you were. Going straight to full volume usually buys a week of soreness and another missed week.',
      physiology: 'Strength is essentially intact after two weeks. Conditioning has dipped slightly, and your tolerance for volume has dropped more than your strength has — which is why the first session back hurts most.',
      recommended: 'reentry',
      options: [option('reentry', true), option('resync', false), option('keep', false)],
    };
  }

  if (days <= 28) {
    return {
      level: 'detraining', daysAway: days, shouldPrompt: true,
      headline: `${days} days off — the plan needs rebuilding`,
      explanation: 'Restarting the cycle with a re-entry week first. You will move back through the volume ramp quickly — regaining is far faster than gaining was.',
      physiology: 'Around three to four weeks off, strength drops measurably and cardio fitness more so. Muscle itself is largely still there, and muscle memory means you rebuild in a fraction of the original time.',
      recommended: 'reentry',
      options: [option('reentry', true), option('restart', false), option('keep', false)],
    };
  }

  return {
    level: 'reset', daysAway: days, shouldPrompt: true,
    headline: `${days} days off — time for a clean slate`,
    explanation: 'Rebuilding your program from week 1. Same goal, same equipment, difficulty reset to something you can finish rather than something you used to do.',
    physiology: 'Past a month, treat yourself as a returning trainee: your connective tissue and work capacity need re-earning even where the muscle remains. The good news is the ramp back is measured in weeks, not months.',
    recommended: 'restart',
    options: [option('restart', true), option('reentry', false), option('keep', false)],
  };
}

