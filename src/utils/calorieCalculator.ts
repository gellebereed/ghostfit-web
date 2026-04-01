// MET values for common exercise types
// Source: Compendium of Physical Activities
const MET_VALUES: Record<string, number> = {
  // Strength training
  'weight_reps': 3.5,      // General weight training
  'bodyweight_reps': 4.0,  // Calisthenics
  'duration': 2.8,         // Isometric/holds
  
  // Cardio
  'treadmill': 8.0,        // Running moderate pace
  'cycling': 7.0,          // Stationary bike moderate
  'rowing': 7.0,           // Rowing machine moderate
  'jump_rope': 10.0,       // Jump rope
  'cardio': 6.0,           // General cardio
};

// More specific MET by exercise name
const EXERCISE_MET: Record<string, number> = {
  'plank': 3.0,
  'push-up': 4.5,
  'pull-up': 5.5,
  'squat': 5.0,
  'deadlift': 6.0,
  'bench press': 4.0,
  'running': 9.0,
  'treadmill': 8.0,
  'cycling': 7.0,
  'rowing': 7.5,
  'burpee': 10.0,
  'jump rope': 10.0,
  'dumbbell': 3.5,
  'barbell': 4.5,
  'cable': 3.5,
};

function getMET(exerciseName: string, metricType: string): number {
  const name = exerciseName.toLowerCase();
  
  // Check specific exercise first
  for (const [key, met] of Object.entries(EXERCISE_MET)) {
    if (name.includes(key)) return met;
  }
  
  // Fall back to metric type
  return MET_VALUES[metricType] ?? 3.5;
}

export function calculateCaloriesBurned(
  exerciseSessions: Array<{
    exerciseName: string;
    metricType: string;
    totalReps: number;
    avgWeight: number;
    setsCompleted: number;
    totalDuration: number;  // seconds
  }>,
  userWeightKg: number = 75  // default if unknown
): number {
  let totalCalories = 0;

  for (const session of exerciseSessions) {
    const met = getMET(session.exerciseName, session.metricType);
    
    let durationHours: number;
    
    if (session.totalDuration > 0) {
      // Cardio/duration — use actual time
      durationHours = session.totalDuration / 3600;
    } else {
      // Strength — estimate time from sets × reps
      // Average: 3 seconds per rep + 90s rest between sets
      const repsTime = session.totalReps * 3;  // seconds
      const restTime = Math.max(0, session.setsCompleted - 1) * 90;
      durationHours = (repsTime + restTime) / 3600;
    }
    
    // Calories = MET × weight(kg) × duration(hours)
    const calories = met * userWeightKg * durationHours;
    totalCalories += calories;
  }

  // Add 10% for post-exercise oxygen consumption (EPOC)
  return Math.round(totalCalories * 1.10);
}

// Helper to get user weight from profile
// If not stored, use 75kg default and show "~" prefix
export function getDisplayCalories(
  calories: number,
  hasExactWeight: boolean
): string {
  return hasExactWeight ? `${calories}` : `~${calories}`;
}
