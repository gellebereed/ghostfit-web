'use client';
import BottomNav from '@/components/BottomNav';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { saveProfile } from '@/lib/db';
import { MealLog, MealPlan, NutritionProfile } from '@/lib/types';
import {
  getCurrentMealPlan, getFoodCatalog, getNutritionProfile, getTodayLogs,
  getWeekAdherence, isCheckinDue, logMeal, requestMealPlan, saveMealPlan,
  saveNutritionProfile, computeTargets,
} from '@/lib/nutrition';

function coachLine(adherence: number, kcalPct: number): string {
  if (kcalPct >= 90) return "Fueled up. Your ghost hates how consistent you're getting. 💚";
  if (adherence >= 80) return "You've been incredibly consistent this week. Trust the process — it's working.";
  if (adherence >= 50) return "Solid week so far. Every logged meal is a data point that makes next week's plan smarter.";
  return "No guilt here — just log what you eat and we'll adjust together. Small steps win.";
}

export default function NutritionPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAppStore();
  const [ready, setReady] = useState(false);
  const [np, setNp] = useState<NutritionProfile | null>(null);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [adherence, setAdherence] = useState(0);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinWeight, setCheckinWeight] = useState(75);
  const [checkinEnergy, setCheckinEnergy] = useState(3);
  const [adapting, setAdapting] = useState(false);
  const [adaptError, setAdaptError] = useState<string | null>(null);

  const load = useCallback(async () => {
    await refreshProfile();
    const nutriProfile = await getNutritionProfile();
    if (!nutriProfile?.onboardingComplete) {
      router.replace('/nutrition/onboarding');
      return;
    }
    setNp(nutriProfile);
    const [mealPlan, todayLogs, adh] = await Promise.all([
      getCurrentMealPlan(),
      getTodayLogs(),
      getWeekAdherence(nutriProfile.mealsPerDay),
    ]);
    setPlan(mealPlan);
    setLogs(todayLogs);
    setAdherence(adh);
    const w = useAppStore.getState().profile?.weight_kg;
    if (w) setCheckinWeight(w);
    setReady(true);
  }, [refreshProfile, router]);

  useEffect(() => { load(); }, [load]);

  async function handleLog(mealIndex: number, status: 'ate' | 'skipped') {
    if (!todayMeals) return;
    const meal = todayMeals[mealIndex];
    const ok = await logMeal(mealIndex, status, meal);
    if (ok) {
      setLogs(prev => [
        ...prev.filter(l => l.mealIndex !== mealIndex),
        {
          logDate: '', mealIndex, status,
          kcal: status === 'ate' ? meal.kcal : 0,
          protein: status === 'ate' ? meal.protein : 0,
          carbs: status === 'ate' ? meal.carbs : 0,
          fat: status === 'ate' ? meal.fat : 0,
        },
      ]);
    }
  }

  async function submitCheckin() {
    if (!np || !plan || !profile) return;
    setAdapting(true);
    setAdaptError(null);
    try {
      const weightChange = checkinWeight - (profile.weight_kg ?? checkinWeight);

      // Recompute targets with the new weight
      const targets = computeTargets({
        weightKg: checkinWeight, heightCm: np.heightCm, age: np.age,
        sex: np.sex, activityLevel: np.activityLevel, goal: profile.goal || 'fitness',
      });
      const updatedNp: NutritionProfile = {
        ...np,
        targetKcal: targets.kcal, targetProtein: targets.protein,
        targetCarbs: targets.carbs, targetFat: targets.fat,
        lastCheckinAt: Date.now(),
      };

      const catalog = await getFoodCatalog(np.countryCode, np.countryName);
      const newPlan = await requestMealPlan({
        profile: updatedNp,
        goal: profile.goal || 'fitness',
        catalog,
        weekNumber: plan.weekNumber + 1,
        adaptation: {
          adherencePercent: adherence,
          weightChangeKg: weightChange,
          energyLevel: checkinEnergy,
        },
      });

      await Promise.all([
        saveNutritionProfile(updatedNp),
        saveMealPlan(newPlan),
        saveProfile({ ...profile, weight_kg: checkinWeight }),
      ]);
      setCheckinOpen(false);
      setAdapting(false);
      await load();
    } catch (e) {
      setAdaptError(e instanceof Error ? e.message : 'Adaptation failed');
      setAdapting(false);
    }
  }

  if (!ready) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div className="ghost-loader" style={{ fontSize: 40 }}>🥗</div>
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Setting the table...</p>
      </div>
    );
  }

  // Which plan day is today? Days cycle weekly from plan creation.
  const dayIdx = plan ? Math.floor((Date.now() - plan.createdAt) / 86400000) % Math.max(plan.days.length, 1) : 0;
  const todayMeals = plan?.days[dayIdx]?.meals ?? null;

  const eaten = logs.filter(l => l.status === 'ate');
  const kcalEaten = eaten.reduce((a, l) => a + l.kcal, 0);
  const proteinEaten = eaten.reduce((a, l) => a + l.protein, 0);
  const kcalPct = np?.targetKcal ? Math.min(100, Math.round((kcalEaten / np.targetKcal) * 100)) : 0;
  const proteinPct = np?.targetProtein ? Math.min(100, Math.round((proteinEaten / np.targetProtein) * 100)) : 0;
  const checkinDue = isCheckinDue(plan);

  return (
    <>
      <header className="hdr">
        <span className="hdr-logo">🥗 FUEL</span>
        <span style={{ color: 'var(--text2)', fontSize: 12, fontWeight: 700 }}>Week {plan?.weekNumber ?? 1} · {adherence}% on plan</span>
      </header>

      <div className="arena-body">
        {checkinDue && (
          <div className="arena-card pending" onClick={() => setCheckinOpen(true)} style={{ cursor: 'pointer' }}>
            <div className="arena-card-head">
              <span style={{ fontSize: 30 }}>📋</span>
              <div>
                <strong>Weekly check-in is ready</strong>
                <p className="arena-card-sub">30 seconds — then I&apos;ll rebuild next week&apos;s plan around your results.</p>
              </div>
            </div>
          </div>
        )}

        {/* Macro progress */}
        <div className="arena-card">
          <div className="arena-card-top">
            <span className="arena-metric">Today&apos;s Fuel</span>
            <span className="arena-timer">{kcalEaten} / {np?.targetKcal} kcal</span>
          </div>
          <div className="arena-race">
            <div className="arena-race-row">
              <span className="arena-race-name you">CALORIES</span>
              <div className="arena-race-track"><div className="arena-race-fill you" style={{ width: `${kcalPct}%` }} /></div>
              <span className="arena-race-score" style={{ fontSize: 12 }}>{kcalPct}%</span>
            </div>
            <div className="arena-race-row">
              <span className="arena-race-name you" style={{ color: '#60A5FA' }}>PROTEIN</span>
              <div className="arena-race-track"><div className="arena-race-fill" style={{ width: `${proteinPct}%`, background: '#60A5FA' }} /></div>
              <span className="arena-race-score" style={{ fontSize: 12 }}>{proteinEaten}g</span>
            </div>
          </div>
          <p className="arena-card-sub" style={{ textAlign: 'center' }}>{coachLine(adherence, kcalPct)}</p>
        </div>

        {/* Today's meals */}
        {todayMeals ? todayMeals.map((meal, i) => {
          const log = logs.find(l => l.mealIndex === i);
          return (
            <div key={i} className={`meal-card ${log?.status ?? ''}`}>
              <div className="meal-card-head">
                <div>
                  <p className="meal-card-name">{meal.name}</p>
                  <p className="meal-card-title">{meal.title}</p>
                </div>
                <span className="meal-card-kcal">{meal.kcal} kcal · {meal.protein}g P</span>
              </div>
              <ul className="meal-card-items">
                {meal.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
              {log ? (
                <p className={`meal-card-logged ${log.status}`}>
                  {log.status === 'ate' ? '✓ Eaten — logged' : 'Skipped'}
                  <button className="meal-undo" onClick={() => handleLog(i, log.status === 'ate' ? 'skipped' : 'ate')}>
                    undo
                  </button>
                </p>
              ) : (
                <div className="arena-actions">
                  <button className="arena-btn accept" onClick={() => handleLog(i, 'ate')}>ATE IT ✓</button>
                  <button className="arena-btn decline" onClick={() => handleLog(i, 'skipped')}>SKIPPED</button>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="arena-empty">
            <div style={{ fontSize: 44 }}>🥗</div>
            <h3>No meal plan yet</h3>
            <p>Set up your food preferences and I&apos;ll build one.</p>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => router.push('/nutrition/onboarding')}>SET UP MY NUTRITION</button>
          </div>
        )}

        <Link href="/nutrition/onboarding" style={{ textAlign: 'center', fontSize: 12, color: 'var(--text2)', padding: 8 }}>
          Edit my foods & preferences ✏️
        </Link>
      </div>

      {/* Check-in modal */}
      {checkinOpen && (
        <div className="sheet-overlay" onClick={() => !adapting && setCheckinOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 className="sheet-title">WEEKLY CHECK-IN</h3>
            <p className="nutri-sub" style={{ textAlign: 'center' }}>
              This week: <strong style={{ color: 'var(--accent)' }}>{adherence}% on plan</strong>. However it went — we adapt, not judge.
            </p>

            <p className="sheet-label">CURRENT WEIGHT (KG)</p>
            <input
              className="nutri-num" type="number" min={30} max={300} step={0.1}
              value={checkinWeight}
              onChange={e => setCheckinWeight(Number(e.target.value))}
            />

            <p className="sheet-label">ENERGY THIS WEEK</p>
            <div className="sheet-options">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} className={`sheet-opt ${checkinEnergy === n ? 'active' : ''}`} onClick={() => setCheckinEnergy(n)}>
                  {['😵', '😪', '😐', '🙂', '⚡'][n - 1]} {n}
                </button>
              ))}
            </div>

            {adaptError && <p className="arena-error">{adaptError}</p>}
            <button className="btn-primary" style={{ marginTop: 16 }} disabled={adapting} onClick={submitCheckin}>
              {adapting ? 'REBUILDING YOUR PLAN...' : 'ADAPT MY PLAN →'}
            </button>
          </div>
        </div>
      )}

      <BottomNav active="fuel" />
    </>
  );
}
