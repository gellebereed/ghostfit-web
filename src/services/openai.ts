import { WorkoutPlan } from '@/lib/types';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getOrderedDays() {
  const today = new Date();
  const todayName = dayNames[today.getDay()];
  
  const orderedDays = [];
  for (let i = 0; i < 7; i++) {
    const dayIndex = (today.getDay() + i) % 7;
    orderedDays.push({
      dayNumber: i + 1,
      dayName: dayNames[dayIndex],
      dayIndex: dayIndex
    });
  }
  return { todayName, orderedDays };
}

export function sanitizeExercise(
  ex: any,
  userEquipment: string[]
): any {
  // Fix missing/invalid equipment
  let equipment = ex.equipment;
  if (
    !equipment ||
    ['any', 'none', 'n/a', ''].includes(equipment.toLowerCase())
  ) {
    const name = ex.name.toLowerCase();
    const cardioEquipMap: Record<string, string> = {
      'treadmill': 'Treadmill', 'run': 'Treadmill', 'jog': 'Treadmill',
      'cycling': 'Spin Bike', 'bike': 'Spin Bike',
      'rowing': 'Rowing Machine', 'row': 'Rowing Machine',
      'jump rope': 'Jump Rope', 'skip': 'Jump Rope',
      'elliptical': 'Elliptical',
    };
    const cardioMatch = Object.entries(cardioEquipMap)
      .find(([k]) => name.includes(k))?.[1];
    const userMatch = userEquipment.find(eq =>
      name.includes(eq.toLowerCase())
    );
    equipment = userMatch ?? cardioMatch ?? userEquipment[0] ?? 'Bodyweight';
  }

  // Backfill metricType if AI forgot it (fallback only)
  let metricType = ex.metricType;
  if (!metricType) {
    const n = ex.name.toLowerCase();
    if (ex.type === 'cardio' ||
        ['treadmill','rowing','cycling','bike','elliptical','skip','run','jog']
        .some(k => n.includes(k))) {
      metricType = 'cardio';
    } else if (['plank','wall sit','dead hang','hold','static','isometric']
        .some(k => n.includes(k))) {
      metricType = 'duration';
    } else if (['push-up','pull-up','dip','sit-up','crunch','bodyweight squat']
        .some(k => n.includes(k)) ||
        equipment.toLowerCase().includes('bodyweight')) {
      metricType = 'bodyweight_reps';
    } else if (['burpee','box jump','jumping jack','mountain climber']
        .some(k => n.includes(k))) {
      metricType = 'reps_only';
    } else {
      metricType = 'weight_reps';
    }
  }

  // Fix reps and durationSeconds based on metricType
  let reps = ex.reps;
  let durationSeconds = ex.durationSeconds;

  if (metricType === 'duration') {
    reps = 0;
    durationSeconds = durationSeconds ?? 30;
  } else if (metricType === 'cardio') {
    reps = 0;
    durationSeconds = durationSeconds ?? 1200;
  } else {
    durationSeconds = null;
    reps = reps && !isNaN(Number(reps)) && Number(reps) > 0
      ? Number(reps) : 10;
  }

  return {
    ...ex,
    equipment,
    metricType,
    reps,
    durationSeconds,
    sets: ex.sets && !isNaN(Number(ex.sets)) ? Number(ex.sets) : 3,
  };
}

export function sanitizePlan(plan: WorkoutPlan, userEquipment: string[]): WorkoutPlan {
  return {
    ...plan,
    days: plan.days.map(day => ({
      ...day,
      exercises: day.exercises.map(ex => sanitizeExercise(ex, userEquipment))
    }))
  };
}

export async function generateWorkoutPlan(equipment: string[], goal: string, weekNumber: number = 1) {
  const apiKey = process.env.OPENAI_API_KEY;
  const { todayName, orderedDays } = getOrderedDays();

  const prompt = `You are an expert fitness coach creating a personalized 
7-day workout plan. Today is ${todayName}.

Equipment available: ${equipment.join(', ')}
Fitness goal: ${goal}
Week: ${weekNumber}
Starting day: ${todayName} (Day 1 of this plan)

The plan MUST start from ${todayName} and follow this day order:
${orderedDays.map(d => `Day ${d.dayNumber}: ${d.dayName}`).join('\n')}

INTELLIGENT PLANNING RULES:
1. REST DAY placement must be smart:
   - Never put rest on Day 1 (today — user is starting now)
   - Place rest day(s) after high-intensity days to allow recovery
   - For goals "Get Stronger" or "Build Muscle": 1 rest day mid-week + 1 at end
   - For "Get Shredded" or "Improve Fitness": 1 rest day at end of week
   - If today is Friday or Saturday, plan accordingly — don't force Sunday rest

2. WORKOUT STRUCTURE must follow muscle split:
   - Never train same muscle group 2 days in a row
   - After Leg day → Upper Body or rest (never Legs again)
   - After Push day → Pull day (never Push again next day)
   - Balance pushing/pulling movements across the week

3. EXERCISE SELECTION must be intelligent:
   - Only use exercises possible with the available equipment
   - Scale difficulty to week number (week 1 = foundation, week 4 = peak)
   - Mix compound and isolation exercises
   - For cardio exercises, use actual cardio equipment if available
     (e.g. Treadmill → Running, Spin Bike → Cycling)
     NOT "any" — always specify the exact equipment

4. SETS AND REPS must match the goal:
   - Get Shredded: higher reps (12-20), shorter rest, circuit style
   - Build Muscle: moderate reps (8-12), 3-4 sets
   - Get Stronger: lower reps (4-6), heavier, 4-5 sets
   - Improve Fitness: mixed (10-15 reps), cardio emphasis

5. METRIC TYPE — include metricType for EVERY exercise.
Base it on how the exercise is truly performed:

'weight_reps' → user lifts a weighted object and counts reps
  Use for: any dumbbell, barbell, cable, machine, 
  kettlebell, or plate-loaded exercise

'bodyweight_reps' → uses only bodyweight, counted in reps
  Use for: push-ups, pull-ups, chin-ups, dips,
  bodyweight squats, sit-ups, crunches, lunges (no weight),
  step-ups (no weight), nordic curls, inverted rows,
  glute bridges (no weight), hip thrusts (no weight)

'duration' → held for time, NOT counted by reps
  Use for: plank, side plank, wall sit, dead hang,
  L-sit, hollow hold, hollow body, superman hold,
  any exercise with the word 'hold' or 'static' or 'isometric'

'cardio' → sustained continuous movement measured in time
  Use for: treadmill, running, jogging, walking on treadmill,
  rowing machine, Concept2 rower, spin bike, stationary bike,
  assault bike, air bike, elliptical, stair climber,
  stair master, ski erg, jump rope session,
  ANY machine the user runs/rows/cycles on continuously

'reps_only' → explosive bodyweight movement counted by reps
  Use for: burpees, box jumps, broad jumps, jumping jacks,
  high knees, mountain climbers, star jumps, tuck jumps,
  battle ropes (counted by rounds)

DURATION FIELDS:
- metricType 'duration' → durationSeconds = recommended hold 
  time in seconds (e.g. 30 for beginner plank, 45 for intermediate)
  AND reps = 0
- metricType 'cardio' → durationSeconds = recommended session 
  duration in seconds (e.g. 1200 for 20 minutes, 600 for 10 minutes)
  AND reps = 0 AND sets = 1
- All other metricTypes → durationSeconds = null

NEVER omit metricType. Every exercise must have it.
NEVER set equipment to 'any', 'none', or leave it empty.
Always use the actual equipment from the user's list.

Return ONLY valid JSON, no markdown, no explanation:
{
  "weekNumber": ${weekNumber},
  "startDay": "${todayName}",
  "days": [
    {
      "dayNumber": 1,
      "dayName": "${orderedDays[0].dayName}",
      "focus": "Upper Body",
      "isRest": false,
      "exercises": [
        {
          "name": "Dumbbell Bicep Curl",
          "sets": 3,
          "reps": 12,
          "equipment": "Dumbbells",
          "type": "strength",
          "metricType": "weight_reps",
          "durationSeconds": null
        },
        {
          "name": "Plank",
          "sets": 3,
          "reps": 0,
          "equipment": "Bodyweight",
          "type": "strength",
          "metricType": "duration",
          "durationSeconds": 30
        },
        {
          "name": "Treadmill Run",
          "sets": 1,
          "reps": 0,
          "equipment": "Treadmill",
          "type": "cardio",
          "metricType": "cardio",
          "durationSeconds": 1200
        }
      ]
    }
  ]
}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Generate my workout plan' }
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const plan = JSON.parse(content);
  return sanitizePlan(plan, equipment);
}

export async function adaptWorkoutPlan(equipment: string[], goal: string, lastPlan: WorkoutPlan, performance: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  const { todayName, orderedDays } = getOrderedDays();
  const nextWeek = (lastPlan?.weekNumber || 0) + 1;

  const prompt = `You are a fitness coach reviewing client performance.
Equipment: ${JSON.stringify(equipment)}
Goal: ${goal}
Last week plan: ${JSON.stringify(lastPlan)}
Performance: ${JSON.stringify(performance)}
Today is ${todayName}.
Starting day: ${todayName} (Day 1 of this new plan)

The plan MUST start from ${todayName} and follow this day order:
${orderedDays.map(d => `Day ${d.dayNumber}: ${d.dayName}`).join('\n')}

Generate updated Week ${nextWeek} plan.
Adapt difficulty:
- Completed 80%+ with wins: increase reps or weight by 10%
- Completed 60-79%: keep same difficulty
- Below 60%: reduce slightly

INTELLIGENT PLANNING RULES:
1. REST DAY placement must be smart (as per intensity Rules).
2. WORKOUT STRUCTURE must follow muscle split rules.
3. Only use exercises possible with available equipment.
4. Scale sets/reps for goal.

5. METRIC TYPE — include metricType for EVERY exercise.
Base it on how the exercise is truly performed:

'weight_reps' → user lifts a weighted object and counts reps
  Use for: any dumbbell, barbell, cable, machine, 
  kettlebell, or plate-loaded exercise

'bodyweight_reps' → uses only bodyweight, counted in reps
  Use for: push-ups, pull-ups, chin-ups, dips,
  bodyweight squats, sit-ups, crunches, lunges (no weight),
  step-ups (no weight), nordic curls, inverted rows,
  glute bridges (no weight), hip thrusts (no weight)

'duration' → held for time, NOT counted by reps
  Use for: plank, side plank, wall sit, dead hang,
  L-sit, hollow hold, hollow body, superman hold,
  any exercise with the word 'hold' or 'static' or 'isometric'

'cardio' → sustained continuous movement measured in time
  Use for: treadmill, running, jogging, walking on treadmill,
  rowing machine, Concept2 rower, spin bike, stationary bike,
  assault bike, air bike, elliptical, stair climber,
  stair master, ski erg, jump rope session,
  ANY machine the user runs/rows/cycles on continuously

'reps_only' → explosive bodyweight movement counted by reps
  Use for: burpees, box jumps, broad jumps, jumping jacks,
  high knees, mountain climbers, star jumps, tuck jumps,
  battle ropes (counted by rounds)

DURATION FIELDS:
- metricType 'duration' → durationSeconds = recommended hold 
  time in seconds (e.g. 30 for beginner plank, 45 for intermediate)
  AND reps = 0
- metricType 'cardio' → durationSeconds = recommended session 
  duration in seconds (e.g. 1200 for 20 minutes, 600 for 10 minutes)
  AND reps = 0 AND sets = 1
- All other metricTypes → durationSeconds = null

NEVER omit metricType. Every exercise must have it.
NEVER set equipment to 'any', 'none', or leave it empty.
Always use the actual equipment from the user's list.

Return JSON matching the same format:
{
  "weekNumber": ${nextWeek},
  "startDay": "${todayName}",
  "days": [...]
}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Generate adapted plan' }
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const plan = JSON.parse(content);
  return sanitizePlan(plan, equipment);
}
