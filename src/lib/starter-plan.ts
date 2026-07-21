import type { Exercise, WorkoutPlan } from './types';

type Goal = 'shredded' | 'muscle' | 'strength' | 'fitness' | string;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function exercise(
  name: string,
  sets: number,
  reps: number,
  equipment = 'Bodyweight Only',
  metricType: Exercise['metricType'] = 'bodyweight_reps',
  durationSeconds: number | null = null,
): Exercise {
  return {
    name,
    sets,
    reps: metricType === 'duration' || metricType === 'cardio' ? 0 : reps,
    equipment,
    type: metricType === 'cardio' ? 'cardio' : 'strength',
    metricType,
    durationSeconds,
  };
}

/**
 * A safe, deterministic plan used when personalized generation is unavailable.
 * It deliberately relies on bodyweight, adding one selected weight/cardio tool
 * only when the user confirmed it is available.
 */
export function createStarterPlan(
  equipment: string[],
  goal: Goal,
  trainingDays = 3,
): WorkoutPlan {
  const available = equipment.length ? equipment : ['Bodyweight Only'];
  const weightTool = available.find(item =>
    ['Dumbbells', 'Kettlebell', 'Barbell', 'Resistance Bands'].includes(item),
  );
  const cardioTool = available.find(item =>
    ['Treadmill', 'Rowing Machine', 'Spin Bike', 'Jump Rope'].includes(item),
  );
  const strengthReps = goal === 'strength' ? 6 : goal === 'muscle' ? 10 : 12;
  const workSets = goal === 'strength' ? 4 : 3;

  const push = [
    exercise(weightTool ? `${weightTool} Chest Press` : 'Push-ups', workSets, strengthReps, weightTool),
    exercise(weightTool ? `${weightTool} Shoulder Press` : 'Pike Push-ups', 3, strengthReps, weightTool),
    exercise('Bodyweight Squats', 3, goal === 'shredded' ? 18 : 12),
    exercise('Plank', 3, 0, 'Bodyweight Only', 'duration', 30),
  ];
  const pull = [
    exercise(weightTool ? `${weightTool} Bent-over Row` : 'Reverse Snow Angels', workSets, strengthReps, weightTool),
    exercise('Glute Bridges', 3, 15),
    exercise('Reverse Lunges', 3, 10),
    exercise('Side Plank', 3, 0, 'Bodyweight Only', 'duration', 25),
  ];
  const conditioning = [
    cardioTool
      ? exercise(`${cardioTool} Intervals`, 1, 0, cardioTool, 'cardio', 900)
      : exercise('Mountain Climbers', 4, 20, 'Bodyweight Only', 'reps_only'),
    exercise('Bodyweight Squats', 3, 15),
    exercise('Push-ups', 3, 10),
    exercise('Dead Bug', 3, 10),
  ];

  const sessions = [push, pull, conditioning, push, pull];
  const today = new Date().getDay();
  const activeDays = Math.max(3, Math.min(5, trainingDays));

  return {
    weekNumber: 1,
    createdAt: Date.now(),
    days: Array.from({ length: 7 }, (_, index) => {
      const isRest = index >= activeDays;
      const dayName = DAY_NAMES[(today + index) % 7];
      return {
        dayNumber: index + 1,
        dayName,
        focus: isRest ? 'Recovery' : ['Full Body Foundation', 'Strength & Control', 'Conditioning', 'Power', 'Total Body'][index],
        isRest,
        exercises: isRest ? [] : sessions[index],
      };
    }),
  };
}
