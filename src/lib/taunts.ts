// Ghost taunt logic — returns a one-liner based on battle state
export function getGhostTaunt(args: {
  yesterdayResult: 'win' | 'loss' | 'none';
  streak: number;
  isRest: boolean;
  isFirstDay: boolean;
  winMarginPercent?: number; // how much you beat ghost by as %
  daysAway?: number | null;  // days since last logged workout
}): string {
  if (args.isFirstDay) return "Complete your first workout. I'll be watching. 👀";
  if (args.isRest) return "Even I'm resting. See you tomorrow. 😴";

  // The ghost feeds on absence — these override everything else
  if (args.daysAway != null && args.daysAway >= 2) {
    if (args.daysAway >= 7) return `${args.daysAway} days. I barely remember your face. I've never been stronger. 👻`;
    if (args.daysAway >= 4) return `${args.daysAway} days of your absence. Delicious. I grow while you shrink. 💀`;
    return `Two days without you. I've been feeding on every excuse. 😈`;
  }

  if (args.yesterdayResult === 'none') return "You didn't show up yesterday. I did. 👻";

  if (args.yesterdayResult === 'loss') return "You gave up. I was just getting started. 😏";

  // Won yesterday
  if (args.streak >= 5) return "I can't stop you. But I'll try tomorrow. 🔥";
  if (args.streak === 3) return "3 in a row? I'm starting to believe in you. 🤔";

  if (args.winMarginPercent !== undefined) {
    if (args.winMarginPercent > 30) return "Okay... you've gotten stronger. I'll be ready. 💀";
    if (args.winMarginPercent < 10) return "Lucky. Won't happen again. 👻";
  }

  return "Ghost is watching. Don't disappoint. 👻";
}
