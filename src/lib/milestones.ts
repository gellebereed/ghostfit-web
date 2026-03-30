// Milestones system
export interface MilestoneEvent {
  id: string;
  icon: string;
  title: string;
  message: string;
}

const MILESTONE_DEFS: Record<string, MilestoneEvent> = {
  FIRST_WORKOUT_COMPLETE: { id: 'FIRST_WORKOUT_COMPLETE', icon: '👻', title: 'GHOST SUMMONED', message: 'Your ghost has been summoned. The battle begins.' },
  FIRST_GHOST_BEATEN: { id: 'FIRST_GHOST_BEATEN', icon: '👊', title: 'FIRST GHOST BEATEN', message: "You're just getting started." },
  STREAK_7: { id: 'STREAK_7', icon: '🔥', title: '7 DAY STREAK', message: 'Ghost has no power here.' },
  STREAK_BROKEN: { id: 'STREAK_BROKEN', icon: '💀', title: 'STREAK BROKEN', message: "Ghost broke your streak. Time to take it back." },
  TIER_2: { id: 'TIER_2', icon: '⚔️', title: 'TIER 2 — FIGHTER', message: 'You earned a new glow.' },
  TIER_3: { id: 'TIER_3', icon: '🗡️', title: 'TIER 3 — WARRIOR', message: 'Ghost is getting nervous.' },
  TIER_4: { id: 'TIER_4', icon: '🏆', title: 'TIER 4 — CHAMPION', message: 'Golden highlights unlocked.' },
  TIER_5: { id: 'TIER_5', icon: '👑', title: 'TIER 5 — LEGEND', message: 'Maximum power reached.' },
};

const MS_KEY = 'ghostfit_milestones';

function getTriggered(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(MS_KEY) || '[]'));
  } catch { return new Set(); }
}

function markTriggered(id: string) {
  const t = getTriggered();
  t.add(id);
  localStorage.setItem(MS_KEY, JSON.stringify([...t]));
}

export function checkMilestones(args: {
  totalWins: number;
  totalSessions: number;
  streak: number;
  justWon: boolean;
  oldTier: number;
  newTier: number;
  personalRecord?: { exerciseName: string; oldBest: number; newBest: number; isCardio: boolean };
  streakBroken?: boolean;
}): MilestoneEvent | null {
  const triggered = getTriggered();
  const today = new Date().toDateString();

  // Personal Record — always fires when set (not stored permanently)
  if (args.personalRecord) {
    const { exerciseName, oldBest, newBest, isCardio } = args.personalRecord;
    const unit = isCardio ? 's' : ' reps';
    return {
      id: 'PERSONAL_RECORD',
      icon: '🏆',
      title: `NEW RECORD — ${exerciseName}`,
      message: `${oldBest}${unit} → ${newBest}${unit}`,
    };
  }

  // Streak Broken — once per calendar day
  if (args.streakBroken && !triggered.has(`STREAK_BROKEN_${today}`)) {
    markTriggered(`STREAK_BROKEN_${today}`);
    return MILESTONE_DEFS.STREAK_BROKEN;
  }

  // Tier up
  if (args.newTier > args.oldTier && !triggered.has(`TIER_${args.newTier}`)) {
    const key = `TIER_${args.newTier}`;
    if (MILESTONE_DEFS[key]) { markTriggered(key); return MILESTONE_DEFS[key]; }
  }

  // First workout
  if (args.totalSessions === 1 && !triggered.has('FIRST_WORKOUT_COMPLETE')) {
    markTriggered('FIRST_WORKOUT_COMPLETE');
    return MILESTONE_DEFS.FIRST_WORKOUT_COMPLETE;
  }

  // First ghost beaten
  if (args.justWon && args.totalWins === 1 && !triggered.has('FIRST_GHOST_BEATEN')) {
    markTriggered('FIRST_GHOST_BEATEN');
    return MILESTONE_DEFS.FIRST_GHOST_BEATEN;
  }

  // 7-day streak
  if (args.streak >= 7 && !triggered.has('STREAK_7')) {
    markTriggered('STREAK_7');
    return MILESTONE_DEFS.STREAK_7;
  }

  return null;
}
