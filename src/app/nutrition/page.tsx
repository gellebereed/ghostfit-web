'use client';
import BottomNav from '@/components/BottomNav';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import { saveProfile } from '@/lib/db';
import { FoodItem, MealLog, MealPlan, NutritionProfile, PlannedMeal } from '@/lib/types';
import {
  getCurrentMealPlan, getFoodCatalog, getMealRecipe, getNutritionProfile,
  getTodayLogs, getWeekAdherence, isCheckinDue, logMeal, logOffPlanMeal, MealRecipe,
  replaceMealInPlan, requestMealPlan, requestSwapMeal, saveMealPlan,
  saveMealPlanDays, saveNutritionProfile, computeTargets,
} from '@/lib/nutrition';

const MEAL_EMOJI: Record<string, string> = {
  'Breakfast': '🍳', 'Lunch': '🍛', 'Snack': '🍎', 'Dinner': '🍲',
};
const DAY_LABELS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];

function coachLine(adherence: number, kcalPct: number): string {
  if (kcalPct >= 90) return "Fueled up. Your ghost hates how consistent you're getting. 💚";
  if (adherence >= 80) return 'Incredibly consistent this week. Trust the process — it\'s working.';
  if (adherence >= 50) return 'Solid week. Every logged meal makes next week\'s plan smarter.';
  return 'No guilt here — just log what you eat and we\'ll adjust together.';
}

export default function NutritionPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAppStore();
  const [ready, setReady] = useState(false);
  const [np, setNp] = useState<NutritionProfile | null>(null);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [adherence, setAdherence] = useState(0);
  const [catalog, setCatalog] = useState<FoodItem[] | null>(null);
  const [viewDay, setViewDay] = useState(0);
  const [todayIdx, setTodayIdx] = useState(0);

  // Recipe modal
  const [recipeFor, setRecipeFor] = useState<PlannedMeal | null>(null);
  const [recipe, setRecipe] = useState<MealRecipe | null>(null);
  const [recipeError, setRecipeError] = useState<string | null>(null);

  // Swap state
  const [swapping, setSwapping] = useState<string | null>(null); // `${day}-${meal}`
  const [swapError, setSwapError] = useState<string | null>(null);

  // Off-plan logging
  const [offPlanFor, setOffPlanFor] = useState<number | null>(null);
  const [offPlanText, setOffPlanText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [offPlanError, setOffPlanError] = useState<string | null>(null);
  const [rebalancing, setRebalancing] = useState(false);
  const [rebalanceDone, setRebalanceDone] = useState(false);

  // Check-in state
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
    if (mealPlan) {
      const idx = Math.floor((Date.now() - mealPlan.createdAt) / 86400000) % Math.max(mealPlan.days.length, 1);
      setTodayIdx(idx);
      setViewDay(idx);
    }
    const w = useAppStore.getState().profile?.weight_kg;
    if (w) setCheckinWeight(w);
    setReady(true);
  }, [refreshProfile, router]);

  useEffect(() => { load(); }, [load]);

  async function ensureCatalog(): Promise<FoodItem[]> {
    if (catalog) return catalog;
    if (!np) return [];
    const foods = await getFoodCatalog(np.countryCode, np.countryName);
    setCatalog(foods);
    return foods;
  }

  async function handleLog(mealIndex: number, status: 'ate' | 'skipped') {
    const meals = plan?.days[todayIdx]?.meals;
    if (!meals) return;
    const meal = meals[mealIndex];
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

  async function openRecipe(meal: PlannedMeal) {
    setRecipeFor(meal);
    setRecipe(null);
    setRecipeError(null);
    try {
      setRecipe(await getMealRecipe(meal, np?.countryName));
    } catch (e) {
      setRecipeError(e instanceof Error ? e.message : 'Recipe failed');
    }
  }

  async function handleLogOffPlan(mealIndex: number) {
    if (!offPlanText.trim() || analyzing) return;
    setAnalyzing(true);
    setOffPlanError(null);
    try {
      const meal = await logOffPlanMeal(mealIndex, plan!.days[todayIdx].meals[mealIndex].name, offPlanText.trim());
      setLogs(prev => [
        ...prev.filter(l => l.mealIndex !== mealIndex),
        { logDate: '', mealIndex, status: 'ate', kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, note: offPlanText.trim() },
      ]);
      setOffPlanFor(null);
      setOffPlanText('');
    } catch (e) {
      setOffPlanError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleRebalance() {
    if (!plan || !np || rebalancing) return;
    setRebalancing(true);
    try {
      const meals = plan.days[todayIdx].meals;
      const remainingIdx = meals.map((_, i) => i).filter(i => !logs.some(l => l.mealIndex === i));
      if (remainingIdx.length === 0) { setRebalancing(false); return; }
      const remainingKcal = Math.max(200, (np.targetKcal ?? 0) - kcalEaten);
      const remainingProtein = Math.max(0, (np.targetProtein ?? 0) - proteinEaten);
      const cat = await ensureCatalog();
      const byId = new Map<string, typeof cat[number]>();
      [...cat, ...np.customFoods].forEach(f => byId.set(f.id, f));
      const liked = np.likedIds.map(id => byId.get(id)).filter(Boolean).map(f => `${f!.name} (${f!.serving}: ${f!.kcal}kcal, ${f!.protein}g P)`);

      const res = await fetch('/api/rebalance-day', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryName: np.countryName,
          remainingMeals: remainingIdx.map(i => meals[i].name),
          remainingKcal, remainingProtein,
          likedFoods: liked, restrictions: np.restrictions,
        }),
      });
      if (!res.ok) throw new Error('rebalance failed');
      const { meals: newMeals } = await res.json();
      let updated = plan;
      remainingIdx.forEach((slot, k) => {
        if (newMeals[k]) updated = { ...updated, days: updated.days.map((d, di) => di !== todayIdx ? d : { ...d, meals: d.meals.map((m, mi) => mi === slot ? newMeals[k] : m) }) };
      });
      await saveMealPlanDays(updated.id, updated.days);
      setPlan(updated);
      setRebalanceDone(true);
    } catch {
      /* stay silent — the log already succeeded */
    } finally {
      setRebalancing(false);
    }
  }

  async function handleSwap(dayIdx: number, mealIdx: number) {
    if (!plan || !np) return;
    const key = `${dayIdx}-${mealIdx}`;
    setSwapping(key);
    setSwapError(null);
    try {
      const cat = await ensureCatalog();
      const meal = plan.days[dayIdx].meals[mealIdx];
      const avoid = plan.days.flatMap(d => d.meals.map(m => m.title));
      const newMeal = await requestSwapMeal({ profile: np, catalog: cat, meal, avoidTitles: avoid });
      const updated = await replaceMealInPlan(plan, dayIdx, mealIdx, newMeal);
      setPlan(updated);
    } catch (e) {
      setSwapError(e instanceof Error ? e.message : 'Swap failed');
    } finally {
      setSwapping(null);
    }
  }

  async function submitCheckin() {
    if (!np || !plan || !profile) return;
    setAdapting(true);
    setAdaptError(null);
    try {
      const weightChange = checkinWeight - (profile.weight_kg ?? checkinWeight);
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
      const cat = await ensureCatalog();
      const newPlan = await requestMealPlan({
        profile: updatedNp,
        goal: profile.goal || 'fitness',
        catalog: cat,
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

  const viewMeals = plan?.days[viewDay]?.meals ?? null;
  const isToday = viewDay === todayIdx;

  const eaten = logs.filter(l => l.status === 'ate');
  const kcalEaten = eaten.reduce((a, l) => a + l.kcal, 0);
  const proteinEaten = eaten.reduce((a, l) => a + l.protein, 0);
  const carbsEaten = eaten.reduce((a, l) => a + l.carbs, 0);
  const fatEaten = eaten.reduce((a, l) => a + l.fat, 0);
  const kcalPct = np?.targetKcal ? Math.min(100, (kcalEaten / np.targetKcal) * 100) : 0;
  const checkinDue = isCheckinDue(plan);

  // Off-plan rescue: if today's projected total blows past target and meals remain, offer a rebalance
  const todayMeals = plan?.days[todayIdx]?.meals ?? [];
  const remainingPlannedKcal = todayMeals.reduce((a, m, i) => a + (logs.some(l => l.mealIndex === i) ? 0 : m.kcal), 0);
  const hasRemainingMeals = todayMeals.some((_, i) => !logs.some(l => l.mealIndex === i));
  const overBudget = !!np?.targetKcal && hasRemainingMeals && (kcalEaten + remainingPlannedKcal) > np.targetKcal * 1.12;

  // Calorie ring geometry
  const R = 52;
  const CIRC = 2 * Math.PI * R;

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

        {/* Macro dashboard */}
        <div className="macro-dash">
          <div className="macro-ring-wrap">
            <svg viewBox="0 0 120 120" className="macro-ring">
              <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface2)" strokeWidth="10" />
              <circle
                cx="60" cy="60" r={R} fill="none" stroke="var(--accent)" strokeWidth="10"
                strokeLinecap="round" strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - kcalPct / 100)}
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)', filter: 'drop-shadow(0 0 6px var(--accent-glow2))' }}
              />
            </svg>
            <div className="macro-ring-center">
              <span className="macro-ring-num">{kcalEaten}</span>
              <span className="macro-ring-label">/ {np?.targetKcal} kcal</span>
            </div>
          </div>
          <div className="macro-bars">
            {[
              { label: 'PROTEIN', eaten: proteinEaten, target: np?.targetProtein ?? 1, color: '#60A5FA' },
              { label: 'CARBS', eaten: carbsEaten, target: np?.targetCarbs ?? 1, color: '#FFB020' },
              { label: 'FAT', eaten: fatEaten, target: np?.targetFat ?? 1, color: '#F472B6' },
            ].map(m => (
              <div className="macro-bar-row" key={m.label}>
                <span className="macro-bar-label">{m.label}</span>
                <div className="arena-race-track" style={{ height: 8 }}>
                  <div className="arena-race-fill" style={{ width: `${Math.min(100, (m.eaten / m.target) * 100)}%`, background: m.color }} />
                </div>
                <span className="macro-bar-val">{m.eaten}<em>/{m.target}g</em></span>
              </div>
            ))}
            <p className="arena-card-sub" style={{ marginTop: 4 }}>{coachLine(adherence, kcalPct)}</p>
          </div>
        </div>

        {plan && (
          <Link href="/nutrition/grocery" className="grocery-link">
            <span style={{ fontSize: 20 }}>🛒</span>
            <span className="grocery-link-text">
              <strong>Grocery list</strong>
              <span className="arena-card-sub">Everything this week&apos;s meals need, totaled</span>
            </span>
            <span style={{ color: 'var(--accent)', fontWeight: 800 }}>→</span>
          </Link>
        )}

        {/* Day browser */}
        {plan && (
          <div className="day-strip">
            {plan.days.map((_, i) => (
              <button
                key={i}
                className={`day-strip-chip ${viewDay === i ? 'active' : ''} ${i === todayIdx ? 'today' : ''}`}
                onClick={() => setViewDay(i)}
              >
                <span className="day-strip-label">{i === todayIdx ? 'TODAY' : DAY_LABELS[i]}</span>
              </button>
            ))}
          </div>
        )}

        {swapError && <p className="arena-error">{swapError}</p>}

        {/* Off-plan rescue */}
        {isToday && overBudget && !rebalanceDone && (
          <div className="rebalance-banner">
            <div>
              <strong>Day&apos;s running over budget</strong>
              <p className="arena-card-sub">You&apos;re on track for ~{kcalEaten + remainingPlannedKcal} kcal vs your {np?.targetKcal} target. Want me to lighten your remaining meals to fit?</p>
            </div>
            <button className="arena-btn accept" disabled={rebalancing} onClick={handleRebalance}>
              {rebalancing ? 'REBALANCING…' : 'REBALANCE ⚖️'}
            </button>
          </div>
        )}
        {isToday && rebalanceDone && (
          <p className="arena-card-sub" style={{ textAlign: 'center', color: 'var(--accent)' }}>
            ⚖️ Rest of today rebalanced to keep you on target.
          </p>
        )}

        {/* Meals for the viewed day */}
        {viewMeals ? viewMeals.map((meal, i) => {
          const log = isToday ? logs.find(l => l.mealIndex === i) : undefined;
          const swapKey = `${viewDay}-${i}`;
          return (
            <div key={`${viewDay}-${i}-${meal.title}`} className={`meal-card v2 ${log?.status ?? ''}`}>
              <div className="meal-card-head">
                <span className="meal-emoji">{MEAL_EMOJI[meal.name] ?? '🍽️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="meal-card-name">{meal.name}</p>
                  <p className="meal-card-title">{meal.title}</p>
                </div>
                <div className="meal-macro-pills">
                  <span className="meal-pill kcal">{meal.kcal}</span>
                  <span className="meal-pill protein">{meal.protein}g P</span>
                </div>
              </div>
              <ul className="meal-card-items">
                {meal.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
              <div className="meal-tools">
                <button className="meal-tool" onClick={() => openRecipe(meal)}>📖 Recipe</button>
                <button
                  className="meal-tool"
                  disabled={swapping !== null}
                  onClick={() => handleSwap(viewDay, i)}
                >{swapping === swapKey ? '🔄 Cooking up a new option...' : '🔄 Swap this meal'}</button>
              </div>
              {isToday && (log ? (
                <p className={`meal-card-logged ${log.status}`}>
                  {log.status === 'ate'
                    ? (log.note ? `✓ Ate off-plan: ${log.note.length > 40 ? log.note.slice(0, 40) + '…' : log.note} · ${log.kcal} kcal` : '✓ Ate as planned')
                    : 'Skipped'}
                  <button className="meal-undo" onClick={() => handleLog(i, log.status === 'ate' ? 'skipped' : 'ate')}>undo</button>
                </p>
              ) : offPlanFor === i ? (
                <div className="offplan-box">
                  <p className="sheet-label" style={{ marginTop: 0 }}>WHAT DID YOU ACTUALLY EAT?</p>
                  <textarea
                    className="arena-input" rows={2} autoFocus
                    style={{ width: '100%', letterSpacing: 0, textTransform: 'none', fontWeight: 500, fontSize: 14, resize: 'none', fontFamily: 'inherit' }}
                    placeholder="e.g. 2 slices of pizza and a can of coke"
                    value={offPlanText}
                    onChange={e => setOffPlanText(e.target.value)}
                  />
                  {offPlanError && <p className="arena-error">{offPlanError}</p>}
                  <div className="arena-actions" style={{ marginTop: 8 }}>
                    <button className="arena-btn accept" disabled={analyzing || !offPlanText.trim()} onClick={() => handleLogOffPlan(i)}>
                      {analyzing ? 'ANALYZING…' : 'ANALYZE & LOG ✨'}
                    </button>
                    <button className="arena-btn decline" onClick={() => { setOffPlanFor(null); setOffPlanText(''); setOffPlanError(null); }}>CANCEL</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="arena-actions">
                    <button className="arena-btn accept" onClick={() => handleLog(i, 'ate')}>ATE IT ✓</button>
                    <button className="arena-btn decline" onClick={() => handleLog(i, 'skipped')}>SKIPPED</button>
                  </div>
                  <button className="offplan-link" onClick={() => { setOffPlanFor(i); setOffPlanText(''); setOffPlanError(null); }}>
                    ✏️ Ate something else instead
                  </button>
                </>
              ))}
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

      {/* Recipe modal */}
      {recipeFor && (
        <div className="sheet-overlay" onClick={() => setRecipeFor(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 className="sheet-title">{MEAL_EMOJI[recipeFor.name] ?? '🍽️'} {recipeFor.title}</h3>
            {!recipe && !recipeError && (
              <p className="nutri-sub" style={{ textAlign: 'center', padding: 20 }}>
                <span className="ghost-loader" style={{ fontSize: 26, display: 'inline-block' }}>👨‍🍳</span><br/>
                Writing your recipe...
              </p>
            )}
            {recipeError && <p className="arena-error">{recipeError}</p>}
            {recipe && (
              <>
                <p className="sheet-label">INGREDIENTS</p>
                <ul className="recipe-list">
                  {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                </ul>
                <p className="sheet-label">STEPS</p>
                <ol className="recipe-steps">
                  {recipe.steps.map((s, i) => <li key={i}><span className="recipe-step-num">{i + 1}</span>{s}</li>)}
                </ol>
                {recipe.tip && <p className="recipe-tip">💡 {recipe.tip}</p>}
              </>
            )}
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setRecipeFor(null)}>DONE</button>
          </div>
        </div>
      )}

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
