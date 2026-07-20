'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/appStore';
import {
  ActivityLevel, FOOD_CATEGORY_LABELS, FoodCategory, FoodItem, FoodPreference,
  NutritionProfile,
} from '@/lib/types';
import {
  ACTIVITY_LABELS, computeTargets, getFoodCatalog, getNutritionProfile,
  requestMealPlan, saveMealPlan, saveNutritionProfile,
} from '@/lib/nutrition';

const COUNTRIES: Array<[string, string]> = [
  ['ET', 'Ethiopia'], ['US', 'United States'], ['GB', 'United Kingdom'], ['DE', 'Germany'],
  ['FR', 'France'], ['IT', 'Italy'], ['ES', 'Spain'], ['NL', 'Netherlands'], ['SE', 'Sweden'],
  ['NO', 'Norway'], ['CA', 'Canada'], ['AU', 'Australia'], ['NZ', 'New Zealand'],
  ['BR', 'Brazil'], ['MX', 'Mexico'], ['AR', 'Argentina'], ['CO', 'Colombia'],
  ['NG', 'Nigeria'], ['KE', 'Kenya'], ['GH', 'Ghana'], ['ZA', 'South Africa'], ['EG', 'Egypt'],
  ['MA', 'Morocco'], ['TZ', 'Tanzania'], ['UG', 'Uganda'], ['IN', 'India'], ['PK', 'Pakistan'],
  ['BD', 'Bangladesh'], ['LK', 'Sri Lanka'], ['CN', 'China'], ['JP', 'Japan'], ['KR', 'South Korea'],
  ['PH', 'Philippines'], ['ID', 'Indonesia'], ['MY', 'Malaysia'], ['TH', 'Thailand'], ['VN', 'Vietnam'],
  ['TR', 'Turkey'], ['SA', 'Saudi Arabia'], ['AE', 'United Arab Emirates'], ['IL', 'Israel'],
  ['RU', 'Russia'], ['UA', 'Ukraine'], ['PL', 'Poland'], ['RO', 'Romania'], ['GR', 'Greece'],
  ['PT', 'Portugal'], ['IE', 'Ireland'], ['CH', 'Switzerland'], ['AT', 'Austria'], ['BE', 'Belgium'],
];

const RESTRICTIONS = ['Vegetarian', 'Vegan', 'Halal', 'No pork', 'No beef', 'No seafood', 'Lactose-free', 'Gluten-free'];

function guessCountry(): string {
  try {
    const region = new Intl.Locale(navigator.language).region;
    if (region && COUNTRIES.some(([c]) => c === region)) return region;
  } catch { /* fall through */ }
  return 'US';
}

const CATEGORY_ORDER: FoodCategory[] = ['protein', 'carb', 'vegetable', 'fruit', 'dairy', 'fat', 'snack', 'drink'];
const NEXT_PREF: Record<string, FoodPreference | null> = {
  none: 'like', like: 'try', try: 'exclude', exclude: null,
};

export default function NutritionOnboardingPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAppStore();
  const [step, setStep] = useState(0);
  const [existing, setExisting] = useState<NutritionProfile | null>(null);

  // Step 1 — about you
  const [countryCode, setCountryCode] = useState('US');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState(25);
  const [heightCm, setHeightCm] = useState(175);
  const [weightKg, setWeightKg] = useState(75);
  const [activity, setActivity] = useState<ActivityLevel>('moderate');

  // Step 2 — preferences
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [mealsPerDay, setMealsPerDay] = useState(3);

  // Step 3 — food picker
  const [catalog, setCatalog] = useState<FoodItem[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, FoodPreference>>({});
  const [customFoods, setCustomFoods] = useState<FoodItem[]>([]);
  const [customName, setCustomName] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Step 4 — generation
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    refreshProfile();
    setCountryCode(guessCountry());
    getNutritionProfile().then(np => {
      if (!np) return;
      setExisting(np);
      if (np.countryCode) setCountryCode(np.countryCode);
      setSex(np.sex);
      setAge(np.age);
      setHeightCm(np.heightCm);
      setActivity(np.activityLevel);
      setRestrictions(np.restrictions);
      setMealsPerDay(np.mealsPerDay);
      setCustomFoods(np.customFoods);
      const restored: Record<string, FoodPreference> = {};
      np.likedIds.forEach(id => { restored[id] = 'like'; });
      np.tryIds.forEach(id => { restored[id] = 'try'; });
      np.excludedIds.forEach(id => { restored[id] = 'exclude'; });
      setPrefs(restored);
    });
  }, [refreshProfile]);

  useEffect(() => {
    if (profile?.weight_kg) setWeightKg(profile.weight_kg);
  }, [profile?.weight_kg]);

  const countryName = COUNTRIES.find(([c]) => c === countryCode)?.[1] ?? 'United States';

  async function loadCatalog() {
    setStep(2);
    setCatalogError(null);
    try {
      const foods = await getFoodCatalog(countryCode, countryName);
      setCatalog(foods);
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : 'Failed to load foods');
    }
  }

  function cyclePref(id: string) {
    setPrefs(prev => {
      const current = prev[id] ?? 'none';
      const next = NEXT_PREF[current];
      const copy = { ...prev };
      if (next === null) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  async function addCustomFood() {
    if (!customName.trim() || addingCustom) return;
    setAddingCustom(true);
    setCustomError(null);
    try {
      const res = await fetch('/api/estimate-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: customName.trim() }),
      });
      if (!res.ok) { setCustomError("Couldn't recognize that as a food — try a clearer name"); return; }
      const { food } = await res.json();
      setCustomFoods(prev => prev.some(f => f.id === food.id) ? prev : [...prev, food]);
      setPrefs(prev => ({ ...prev, [food.id]: 'like' }));
      setCustomName('');
    } catch {
      setCustomError('Something went wrong — try again');
    } finally {
      setAddingCustom(false);
    }
  }

  const likedCount = Object.values(prefs).filter(p => p === 'like').length;

  async function generatePlan() {
    if (!profile) return;
    setGenerating(true);
    setGenError(null);
    try {
      const targets = computeTargets({
        weightKg, heightCm, age, sex, activityLevel: activity, goal: profile.goal || 'fitness',
      });

      const np: NutritionProfile = {
        countryCode,
        countryName,
        sex, age, heightCm,
        activityLevel: activity,
        restrictions,
        mealsPerDay,
        likedIds: Object.entries(prefs).filter(([, p]) => p === 'like').map(([id]) => id),
        tryIds: Object.entries(prefs).filter(([, p]) => p === 'try').map(([id]) => id),
        excludedIds: Object.entries(prefs).filter(([, p]) => p === 'exclude').map(([id]) => id),
        customFoods,
        targetKcal: targets.kcal,
        targetProtein: targets.protein,
        targetCarbs: targets.carbs,
        targetFat: targets.fat,
        onboardingComplete: true,
        lastCheckinAt: existing?.lastCheckinAt ?? null,
      };
      await saveNutritionProfile(np);

      const plan = await requestMealPlan({
        profile: np,
        goal: profile.goal || 'fitness',
        catalog: catalog ?? [],
        weekNumber: 1,
      });
      await saveMealPlan(plan);
      router.replace('/nutrition');
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Plan generation failed');
      setGenerating(false);
    }
  }

  if (generating) {
    return (
      <div className="plan-loading">
        <div className="plan-spinner" />
        <h2>YOUR NUTRITIONIST IS <span className="green">COOKING</span>...</h2>
        <p>Building 7 days of meals from foods you actually love</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <header className="hdr">
        <button className="hdr-back" onClick={() => (step === 0 ? router.push('/nutrition') : setStep(step - 1))}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span className="hdr-logo">🥗 NUTRITIONIST</span>
        <span style={{ color: 'var(--text3)', fontSize: 12, fontWeight: 700 }}>{step + 1}/4</span>
      </header>

      {step === 0 && (
        <div className="nutri-step">
          <h2 className="nutri-title">Let&apos;s get to know you</h2>
          <p className="nutri-sub">Your meal plan is built from your body, your goal, and your country&apos;s food.</p>

          <p className="sheet-label">WHERE DO YOU LIVE?</p>
          <select className="nutri-select" value={countryCode} onChange={e => setCountryCode(e.target.value)}>
            {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>

          <p className="sheet-label">BIOLOGICAL SEX (for calorie math)</p>
          <div className="sheet-options">
            <button className={`sheet-opt ${sex === 'male' ? 'active' : ''}`} onClick={() => setSex('male')}>Male</button>
            <button className={`sheet-opt ${sex === 'female' ? 'active' : ''}`} onClick={() => setSex('female')}>Female</button>
          </div>

          <div className="nutri-row2">
            <div>
              <p className="sheet-label">AGE</p>
              <input className="nutri-num" type="number" min={13} max={100} value={age} onChange={e => setAge(Number(e.target.value))} />
            </div>
            <div>
              <p className="sheet-label">HEIGHT (CM)</p>
              <input className="nutri-num" type="number" min={100} max={250} value={heightCm} onChange={e => setHeightCm(Number(e.target.value))} />
            </div>
            <div>
              <p className="sheet-label">WEIGHT (KG)</p>
              <input className="nutri-num" type="number" min={30} max={300} value={weightKg} onChange={e => setWeightKg(Number(e.target.value))} />
            </div>
          </div>

          <p className="sheet-label">ACTIVITY LEVEL</p>
          <div className="nutri-activity">
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(a => (
              <button key={a} className={`nutri-activity-opt ${activity === a ? 'active' : ''}`} onClick={() => setActivity(a)}>
                <strong style={{ textTransform: 'capitalize' }}>{a}</strong>
                <span>{ACTIVITY_LABELS[a]}</span>
              </button>
            ))}
          </div>

          <button className="btn-primary" style={{ marginTop: 24 }} onClick={() => setStep(1)}>CONTINUE →</button>
        </div>
      )}

      {step === 1 && (
        <div className="nutri-step">
          <h2 className="nutri-title">Any rules I should know?</h2>
          <p className="nutri-sub">I&apos;ll never plan a meal that breaks these.</p>

          <p className="sheet-label">DIETARY RESTRICTIONS</p>
          <div className="sheet-options">
            {RESTRICTIONS.map(r => (
              <button
                key={r}
                className={`sheet-opt ${restrictions.includes(r) ? 'active' : ''}`}
                onClick={() => setRestrictions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
              >{r}</button>
            ))}
          </div>

          <p className="sheet-label">MEALS PER DAY</p>
          <div className="sheet-options">
            <button className={`sheet-opt ${mealsPerDay === 3 ? 'active' : ''}`} onClick={() => setMealsPerDay(3)}>3 meals</button>
            <button className={`sheet-opt ${mealsPerDay === 4 ? 'active' : ''}`} onClick={() => setMealsPerDay(4)}>3 meals + snack</button>
          </div>

          <button className="btn-primary" style={{ marginTop: 24 }} onClick={loadCatalog}>SHOW ME MY FOODS →</button>
        </div>
      )}

      {step === 2 && (
        <div className="nutri-step">
          {!catalog && !catalogError && (
            <div className="arena-empty" style={{ paddingTop: 80 }}>
              <div className="ghost-loader" style={{ fontSize: 44 }}>🥗</div>
              <h3>Researching {countryName}&apos;s food...</h3>
              <p>Your nutritionist is building a catalog of foods that are actually available near you. First time for a country takes ~30 seconds.</p>
            </div>
          )}
          {catalogError && (
            <div className="arena-empty" style={{ paddingTop: 80 }}>
              <div style={{ fontSize: 44 }}>😕</div>
              <h3>Couldn&apos;t load foods</h3>
              <p>{catalogError}</p>
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={loadCatalog}>TRY AGAIN</button>
            </div>
          )}
          {catalog && (
            <>
              <h2 className="nutri-title">Pick your foods</h2>
              <p className="nutri-sub">
                Tap to cycle: <span className="pref-chip like">✓ I eat this</span>{' '}
                <span className="pref-chip try">★ Want to try</span>{' '}
                <span className="pref-chip exclude">✕ Never</span>
              </p>

              {CATEGORY_ORDER.map(cat => {
                const foods = [...catalog, ...customFoods].filter(f => f.category === cat);
                if (foods.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="sheet-label">{FOOD_CATEGORY_LABELS[cat]}</p>
                    <div className="sheet-options">
                      {foods.map(f => {
                        const p = prefs[f.id];
                        return (
                          <button
                            key={f.id}
                            className={`food-chip ${p ?? ''}`}
                            onClick={() => cyclePref(f.id)}
                            title={`${f.serving}: ${f.kcal} kcal · ${f.protein}g protein`}
                          >
                            {p === 'like' ? '✓ ' : p === 'try' ? '★ ' : p === 'exclude' ? '✕ ' : ''}{f.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <p className="sheet-label">MISSING SOMETHING YOU EAT?</p>
              <div className="arena-code-row" style={{ justifyContent: 'stretch' }}>
                <input
                  className="arena-input"
                  style={{ letterSpacing: 0, textTransform: 'none', fontWeight: 600 }}
                  placeholder="e.g. kocho, ayib, atmit..."
                  value={customName}
                  onChange={e => { setCustomName(e.target.value); setCustomError(null); }}
                  onKeyDown={e => e.key === 'Enter' && addCustomFood()}
                />
                <button className="arena-btn accept" onClick={addCustomFood} disabled={addingCustom}>
                  {addingCustom ? '...' : '+ ADD'}
                </button>
              </div>
              {customError && <p className="arena-error">{customError}</p>}

              <div className="nutri-sticky">
                <button
                  className="btn-primary"
                  disabled={likedCount < 8}
                  style={{ opacity: likedCount < 8 ? 0.5 : 1 }}
                  onClick={() => setStep(3)}
                >
                  {likedCount < 8 ? `PICK AT LEAST 8 FOODS YOU EAT (${likedCount}/8)` : `CONTINUE WITH ${likedCount} FOODS →`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 3 && (() => {
        const targets = computeTargets({
          weightKg, heightCm, age, sex, activityLevel: activity, goal: profile?.goal || 'fitness',
        });
        return (
          <div className="nutri-step">
            <h2 className="nutri-title">Your daily targets</h2>
            <p className="nutri-sub">Computed from your body and your &quot;{profile?.goal || 'fitness'}&quot; goal. Your plan adapts weekly from your results.</p>

            <div className="nutri-targets">
              <div className="nutri-target"><span className="nutri-target-num">{targets.kcal}</span><span className="nutri-target-label">KCAL / DAY</span></div>
              <div className="nutri-target"><span className="nutri-target-num">{targets.protein}g</span><span className="nutri-target-label">PROTEIN</span></div>
              <div className="nutri-target"><span className="nutri-target-num">{targets.carbs}g</span><span className="nutri-target-label">CARBS</span></div>
              <div className="nutri-target"><span className="nutri-target-num">{targets.fat}g</span><span className="nutri-target-label">FAT</span></div>
            </div>

            <p className="nutri-sub" style={{ marginTop: 16 }}>
              7 days · {mealsPerDay} meals/day · built only from the {likedCount} foods you chose
              {Object.values(prefs).filter(p => p === 'try').length > 0 && `, with ${Object.values(prefs).filter(p => p === 'try').length} new foods to discover`}.
            </p>

            {genError && <p className="arena-error">{genError}</p>}
            <button className="btn-primary" style={{ marginTop: 20 }} onClick={generatePlan}>
              BUILD MY MEAL PLAN 🥗
            </button>
          </div>
        );
      })()}
    </div>
  );
}
