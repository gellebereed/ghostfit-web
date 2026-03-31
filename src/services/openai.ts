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

export function sanitizePlan(plan: WorkoutPlan, userEquipment: string[]): WorkoutPlan {
  return {
    ...plan,
    days: plan.days.map(day => ({
      ...day,
      exercises: day.exercises.map(ex => {
        // Fix "any", "none", "", undefined equipment
        if (
          !ex.equipment ||
          ex.equipment.toLowerCase() === 'any' ||
          ex.equipment.toLowerCase() === 'none' ||
          ex.equipment.toLowerCase() === 'n/a' ||
          ex.equipment === ''
        ) {
          // Try to infer equipment from exercise name
          const name = ex.name.toLowerCase();
          const inferred = userEquipment.find(eq =>
            name.includes(eq.toLowerCase())
          );
          
          // Cardio equipment mapping
          const cardioMap: Record<string, string> = {
            'treadmill': 'Treadmill',
            'run': 'Treadmill',
            'jog': 'Treadmill',
            'cycling': 'Spin Bike',
            'bike': 'Spin Bike',
            'rowing': 'Rowing Machine',
            'row': 'Rowing Machine',
            'jump rope': 'Jump Rope',
            'skip': 'Jump Rope',
          };
          
          const cardioEquip = Object.entries(cardioMap).find(([key]) =>
            name.includes(key)
          )?.[1];
          
          return {
            ...ex,
            equipment: inferred ?? cardioEquip ?? userEquipment[0] ?? 'Bodyweight'
          };
        }
        return ex;
      })
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
          "name": "Dumbbell Bench Press",
          "sets": 4,
          "reps": 10,
          "equipment": "Dumbbells",
          "type": "strength"
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
