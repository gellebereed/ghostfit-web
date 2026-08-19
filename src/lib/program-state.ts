/**
 * GhostFit — Program State
 *
 * The training preferences and mesocycle position the engine needs. Kept in
 * localStorage for instant, offline reads and mirrored to a single
 * `profiles.training_state` JSON column when that column exists.
 *
 * The mirror is written in its own request, never bundled into saveProfile, so
 * a project that has not run the migration yet still saves everything else.
 */
import { supabase } from './supabase';
import { FOCUS_AREAS, normalizeFocusFrequency, type FocusAreaId, type FocusFrequency } from './focus-library';
import type { ExperienceLevel, TrainingPhase } from './types';

const KEY = 'ghostfit_program_state';
/** The pre-engine key onboarding used to write. Read once, then migrated. */
const LEGACY_KEY = 'ghostfit_training_preferences';

export interface ProgramState {
  experience: ExperienceLevel;
  trainingDays: number;
  /** Exact weekdays the user trains (0 = Sunday). null = let the split decide. */
  trainingDayIndices: number[] | null;
  sessionMinutes: number;
  /** Absolute week of the program — the periodization clock. */
  programWeek: number;
  /** Epoch ms the current week's plan was generated. */
  weekStartedAt: number;
  /** Body part the user asked to specialize in. null = balanced program. */
  focusArea: FocusAreaId | null;
  /** How many sessions a week carry the focus block. */
  focusFrequency: FocusFrequency;
  /** Set while the user is working through a post-layoff re-entry week. */
  phaseOverride: TrainingPhase | null;
  /** Days-off value of the last comeback prompt the user answered. */
  lastLayoffHandledDays: number;
  /** Epoch ms — suppresses re-prompting on every page view. */
  lastLayoffPromptAt: number;
}

export const DEFAULT_PROGRAM_STATE: ProgramState = {
  experience: 'beginner',
  trainingDays: 3,
  trainingDayIndices: null,
  sessionMinutes: 45,
  focusArea: null,
  focusFrequency: 'standard',
  programWeek: 1,
  weekStartedAt: 0,
  phaseOverride: null,
  lastLayoffHandledDays: 0,
  lastLayoffPromptAt: 0,
};

function coerce(raw: unknown): ProgramState {
  const value = (raw ?? {}) as Partial<ProgramState> & { trainingDays?: unknown; sessionMinutes?: unknown };
  const experience = value.experience === 'intermediate' || value.experience === 'advanced'
    ? value.experience
    : 'beginner';
  return {
    experience,
    trainingDays: clamp(Number(value.trainingDays) || DEFAULT_PROGRAM_STATE.trainingDays, 2, 6),
    trainingDayIndices: normalizeDays(value.trainingDayIndices),
    sessionMinutes: clamp(Number(value.sessionMinutes) || DEFAULT_PROGRAM_STATE.sessionMinutes, 20, 120),
    focusArea: value.focusArea && value.focusArea in FOCUS_AREAS ? (value.focusArea as FocusAreaId) : null,
    focusFrequency: normalizeFocusFrequency(value.focusFrequency),
    programWeek: Math.max(1, Math.round(Number(value.programWeek) || 1)),
    weekStartedAt: Number(value.weekStartedAt) || 0,
    phaseOverride: value.phaseOverride ?? null,
    lastLayoffHandledDays: Number(value.lastLayoffHandledDays) || 0,
    lastLayoffPromptAt: Number(value.lastLayoffPromptAt) || 0,
  };
}

function normalizeDays(days: unknown): number[] | null {
  if (!Array.isArray(days)) return null;
  const clean = [...new Set(days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))]
    .sort((a, b) => a - b);
  return clean.length >= 2 && clean.length <= 6 ? clean : null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

let cache: ProgramState | null = null;

export function getProgramState(): ProgramState {
  if (cache) return cache;
  if (typeof window === 'undefined') return DEFAULT_PROGRAM_STATE;

  const stored = localStorage.getItem(KEY);
  if (stored) {
    try {
      cache = coerce(JSON.parse(stored));
      return cache;
    } catch {
      /* fall through to the legacy read */
    }
  }

  // Onboarding wrote a preferences blob before the engine existed — adopt it.
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    try {
      cache = coerce(JSON.parse(legacy));
      localStorage.setItem(KEY, JSON.stringify(cache));
      return cache;
    } catch {
      /* ignore */
    }
  }

  cache = { ...DEFAULT_PROGRAM_STATE };
  return cache;
}

export function saveProgramState(patch: Partial<ProgramState>): ProgramState {
  const next = coerce({ ...getProgramState(), ...patch });
  cache = next;
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY, JSON.stringify(next));
    // Keep the legacy key in sync so any un-migrated reader stays correct.
    localStorage.setItem(LEGACY_KEY, JSON.stringify({
      experience: next.experience,
      trainingDays: next.trainingDays,
      sessionMinutes: next.sessionMinutes,
    }));
  }
  void mirrorToSupabase(next);
  return next;
}

/** Advance the periodization clock by one week. */
export function advanceProgramWeek(): ProgramState {
  const current = getProgramState();
  return saveProgramState({
    programWeek: current.programWeek + 1,
    weekStartedAt: Date.now(),
    // A re-entry week is a one-week detour, not a permanent setting.
    phaseOverride: null,
  });
}

/** Wipe the periodization clock — used by a full program reset. */
export function resetProgramClock(phase: TrainingPhase | null = null): ProgramState {
  return saveProgramState({
    programWeek: 1,
    weekStartedAt: Date.now(),
    phaseOverride: phase,
    lastLayoffHandledDays: 0,
  });
}

/**
 * Best-effort mirror. A missing column is expected on installs that have not
 * run `training-engine.sql`, so a failure here is logged, never thrown.
 */
async function mirrorToSupabase(state: ProgramState): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    const { error } = await supabase
      .from('profiles')
      .update({ training_state: state })
      .eq('id', userId);
    if (error) console.warn('Program state mirror skipped:', error.message);
  } catch (err) {
    console.warn('Program state mirror failed:', err);
  }
}

/** Pull the server copy on a fresh device. Silent when the column is absent. */
export async function hydrateProgramState(): Promise<ProgramState> {
  const local = getProgramState();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return local;
    const { data, error } = await supabase
      .from('profiles')
      .select('training_state')
      .eq('id', userId)
      .single();
    if (error || !data?.training_state) return local;

    const remote = coerce(data.training_state);
    // The device that trained most recently holds the truth.
    if (remote.weekStartedAt > local.weekStartedAt) {
      cache = remote;
      if (typeof window !== 'undefined') localStorage.setItem(KEY, JSON.stringify(remote));
      return remote;
    }
  } catch {
    /* offline or column missing — the local copy is authoritative */
  }
  return local;
}
