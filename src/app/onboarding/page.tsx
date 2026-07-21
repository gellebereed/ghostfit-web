'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ALL_EQUIPMENT, EQUIPMENT_ICONS } from '@/lib/equipment-icons';
import { getProfile, savePlan, saveProfile } from '@/lib/db';
import { createStarterPlan } from '@/lib/starter-plan';

const DRAFT_KEY = 'ghostfit_onboarding_draft_v2';

const GOALS = [
  { id: 'shredded', icon: '🔥', title: 'Get Shredded', desc: 'Burn fat and reveal definition' },
  { id: 'muscle', icon: '💪', title: 'Build Muscle', desc: 'Add size with progressive training' },
  { id: 'strength', icon: '⚡', title: 'Get Stronger', desc: 'Build confidence and raw strength' },
  { id: 'fitness', icon: '🏃', title: 'Improve Fitness', desc: 'Move better and build endurance' },
] as const;

const EXPERIENCE = [
  { id: 'beginner', label: 'Beginner', desc: 'New or returning after a break' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Training consistently for 6+ months' },
  { id: 'advanced', label: 'Advanced', desc: 'Experienced with structured programs' },
] as const;

interface Draft {
  step: number;
  goal: string;
  experience: string;
  trainingDays: number;
  sessionMinutes: number;
  equipment: string[];
  name: string;
  weightKg: number;
}

const DEFAULT_DRAFT: Draft = {
  step: 0,
  goal: '',
  experience: 'beginner',
  trainingDays: 3,
  sessionMinutes: 45,
  equipment: ['Bodyweight Only'],
  name: '',
  weightKg: 75,
};

export default function OnboardingPage() {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [ready, setReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [building, setBuilding] = useState(false);
  const [buildStatus, setBuildStatus] = useState('Personalizing your first week');

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        const profile = await getProfile();
        if (profile?.onboardingComplete) {
          router.replace('/');
          return;
        }
        const restored = saved ? { ...DEFAULT_DRAFT, ...JSON.parse(saved) } as Draft : DEFAULT_DRAFT;
        setDraft({
          ...restored,
          name: restored.name || profile?.characterName || '',
          weightKg: profile?.weight_kg || restored.weightKg,
          equipment: profile?.equipment?.length ? profile.equipment : restored.equipment,
          goal: profile?.goal || restored.goal,
        });
      } catch {
        setDraft(DEFAULT_DRAFT);
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  function update(patch: Partial<Draft>) {
    setDraft(current => {
      const next = { ...current, ...patch };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      return next;
    });
  }

  function goTo(step: number) {
    update({ step: Math.max(0, Math.min(3, step)) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleEquipment(item: string) {
    const selected = draft.equipment.includes(item);
    const next = selected ? draft.equipment.filter(value => value !== item) : [...draft.equipment, item];
    update({ equipment: next.length ? next : ['Bodyweight Only'] });
  }

  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanError('');
    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      if (!response.ok) throw new Error('Scan unavailable');
      const result = await response.json() as { equipment?: string[] };
      if (!result.equipment?.length) throw new Error('No equipment recognized');
      update({ equipment: [...new Set([...draft.equipment, ...result.equipment])] });
    } catch {
      setScanError('I could not read that photo. Pick your equipment below instead.');
    } finally {
      setScanning(false);
      event.target.value = '';
    }
  }

  async function finishOnboarding() {
    setBuilding(true);
    setBuildStatus('Building your training rhythm');
    const safeEquipment = draft.equipment.length ? draft.equipment : ['Bodyweight Only'];
    let plan = createStarterPlan(safeEquipment, draft.goal, draft.trainingDays);
    try {
      setBuildStatus('Personalizing exercises to your equipment');
      const response = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipment: safeEquipment,
          goal: draft.goal,
          experience: draft.experience,
          trainingDays: draft.trainingDays,
          sessionMinutes: draft.sessionMinutes,
        }),
      });
      if (response.ok) {
        const generated = await response.json();
        if (Array.isArray(generated.days) && generated.days.length === 7) {
          plan = { ...generated, createdAt: Date.now() };
        }
      }
    } catch {
      setBuildStatus('Using your ready-to-train starter plan');
    }

    const name = (draft.name.trim() || 'FIGHTER').toUpperCase().slice(0, 16);
    await savePlan(plan);
    await saveProfile({
      equipment: safeEquipment,
      goal: draft.goal || 'fitness',
      currentWeek: 1,
      onboardingComplete: true,
      createdAt: Date.now(),
      soulCoins: 0,
      unlockedCosmetics: [],
      equippedCosmetics: {},
      weight_kg: draft.weightKg || 75,
      current_streak: 0,
      streakShields: 0,
      characterName: name,
      ghostName: `${name} GHOST`.slice(0, 16),
      characterStyle: 'warrior',
      auraColor: '#00FF87',
      ghostStyle: 'warrior',
      ghostAuraColor: '#FFFFFF',
    });
    localStorage.setItem('ghostfit_training_preferences', JSON.stringify({
      experience: draft.experience,
      trainingDays: draft.trainingDays,
      sessionMinutes: draft.sessionMinutes,
    }));
    localStorage.removeItem(DRAFT_KEY);
    router.replace('/');
  }

  if (!ready || building) {
    return (
      <main className="plan-loading onb-shell" aria-live="polite">
        <div className="plan-spinner" />
        <p className="onb-kicker">YOUR FIRST BATTLE PLAN</p>
        <h1>{building ? 'FORGING YOUR PLAN' : 'LOADING YOUR PROFILE'}</h1>
        <p>{building ? buildStatus : 'Picking up exactly where you left off'}</p>
      </main>
    );
  }

  const stepValid = [Boolean(draft.goal), true, draft.equipment.length > 0, true][draft.step];

  return (
    <main className="onb-shell">
      <header className="onb-header">
        <button
          type="button"
          className="hdr-back onb-back"
          aria-label="Go to previous onboarding step"
          onClick={() => draft.step > 0 && goTo(draft.step - 1)}
          disabled={draft.step === 0}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span className="hdr-logo">GHOSTFIT</span>
        <span className="onb-step-count">{draft.step + 1}/4</span>
      </header>

      <div className="onb-progress-track" aria-label={`Step ${draft.step + 1} of 4`}>
        <span style={{ width: `${((draft.step + 1) / 4) * 100}%` }} />
      </div>

      <section className="onb-stage">
        {draft.step === 0 && (
          <>
            <p className="onb-kicker">BUILD YOUR FIGHTER PROFILE</p>
            <h1 className="onb-title">What are we<br /><span className="green">fighting for?</span></h1>
            <p className="onb-sub">Choose your primary goal. You can change it any time.</p>
            <div className="onb-goal-grid" role="radiogroup" aria-label="Primary fitness goal">
              {GOALS.map(goal => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={draft.goal === goal.id}
                  key={goal.id}
                  className={`goal-card ${draft.goal === goal.id ? 'selected' : ''}`}
                  onClick={() => update({ goal: goal.id })}
                >
                  <span className="goal-icon" aria-hidden="true">{goal.icon}</span>
                  <span className="goal-info"><strong>{goal.title}</strong><small>{goal.desc}</small></span>
                  <span className="goal-radio" aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className="onb-field-label">YOUR EXPERIENCE</p>
            <div className="onb-choice-row" role="radiogroup" aria-label="Training experience">
              {EXPERIENCE.map(option => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={draft.experience === option.id}
                  className={`onb-choice ${draft.experience === option.id ? 'selected' : ''}`}
                  key={option.id}
                  onClick={() => update({ experience: option.id })}
                ><strong>{option.label}</strong><span>{option.desc}</span></button>
              ))}
            </div>
          </>
        )}

        {draft.step === 1 && (
          <>
            <p className="onb-kicker">MAKE IT FIT REAL LIFE</p>
            <h1 className="onb-title">Choose a rhythm<br /><span className="green">you can own.</span></h1>
            <p className="onb-sub">Consistency beats an impossible schedule. We recommend three days to start.</p>
            <div className="onb-rhythm-card">
              <div><span className="onb-field-label">TRAINING DAYS</span><strong className="onb-big-value">{draft.trainingDays}<small> / week</small></strong></div>
              <div className="onb-segment" role="radiogroup" aria-label="Training days per week">
                {[3, 4, 5].map(days => <button type="button" role="radio" aria-checked={draft.trainingDays === days} className={draft.trainingDays === days ? 'selected' : ''} key={days} onClick={() => update({ trainingDays: days })}>{days}</button>)}
              </div>
            </div>
            <div className="onb-rhythm-card">
              <div><span className="onb-field-label">SESSION LENGTH</span><strong className="onb-big-value">{draft.sessionMinutes}<small> min</small></strong></div>
              <div className="onb-segment" role="radiogroup" aria-label="Session duration">
                {[30, 45, 60].map(minutes => <button type="button" role="radio" aria-checked={draft.sessionMinutes === minutes} className={draft.sessionMinutes === minutes ? 'selected' : ''} key={minutes} onClick={() => update({ sessionMinutes: minutes })}>{minutes}</button>)}
              </div>
            </div>
            <div className="onb-insight"><span aria-hidden="true">⚡</span><div><strong>A plan built to finish</strong><p>{draft.trainingDays} focused sessions of about {draft.sessionMinutes} minutes, with recovery already programmed.</p></div></div>
          </>
        )}

        {draft.step === 2 && (
          <>
            <p className="onb-kicker">TRAIN WITH WHAT YOU HAVE</p>
            <h1 className="onb-title">Your gym.<br /><span className="green">Your rules.</span></h1>
            <p className="onb-sub">Bodyweight works from day one. Add only equipment you can access consistently.</p>
            <div className="onb-scan-row">
              <button type="button" className="onb-scan" onClick={() => cameraRef.current?.click()}><span>📷</span><strong>Scan equipment</strong><small>Use camera</small></button>
              <button type="button" className="onb-scan" onClick={() => galleryRef.current?.click()}><span>🖼️</span><strong>Upload photo</strong><small>Choose image</small></button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="camera-input" onChange={handlePhoto} />
            <input ref={galleryRef} type="file" accept="image/*" className="camera-input" onChange={handlePhoto} />
            <div aria-live="polite">{scanning && <p className="onb-notice">Scanning your setup…</p>}{scanError && <p className="onb-error">{scanError}</p>}</div>
            <p className="onb-field-label">SELECT EQUIPMENT</p>
            <div className="equip-card-grid onb-equipment-grid">
              {ALL_EQUIPMENT.map(item => {
                const selected = draft.equipment.includes(item);
                return (
                  <button type="button" aria-pressed={selected} key={item} className={`equip-card ${selected ? 'selected' : ''}`} onClick={() => toggleEquipment(item)}>
                    <svg className="eqicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={EQUIPMENT_ICONS[item]} /></svg>
                    <span className="eqname">{item}</span>{selected && <span className="eq-check" aria-hidden="true">✓</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {draft.step === 3 && (
          <>
            <p className="onb-kicker">READY FOR ROUND ONE</p>
            <h1 className="onb-title">Meet your<br /><span className="green">battle plan.</span></h1>
            <p className="onb-sub">These final details are optional. Nutrition can use your weight later without asking twice.</p>
            <div className="onb-profile-fields">
              <label><span className="onb-field-label">FIGHTER NAME <small>OPTIONAL</small></span><input value={draft.name} maxLength={16} autoComplete="name" placeholder="FIGHTER" onChange={event => update({ name: event.target.value })} /></label>
              <label><span className="onb-field-label">BODY WEIGHT <small>OPTIONAL</small></span><div className="onb-input-suffix"><input type="number" inputMode="decimal" min={30} max={300} value={draft.weightKg} onChange={event => update({ weightKg: Number(event.target.value) || 75 })} /><span>KG</span></div></label>
            </div>
            <div className="onb-summary">
              <div><span>Primary goal</span><strong>{GOALS.find(goal => goal.id === draft.goal)?.title}</strong></div>
              <div><span>Training rhythm</span><strong>{draft.trainingDays} days × {draft.sessionMinutes} min</strong></div>
              <div><span>Experience</span><strong>{draft.experience}</strong></div>
              <div><span>Equipment</span><strong>{draft.equipment.length} selected</strong></div>
            </div>
            <div className="onb-guarantee"><span>✓</span><p><strong>You will always get a plan.</strong><br />If AI personalization is unavailable, GhostFit instantly starts you with a coach-designed foundation week.</p></div>
          </>
        )}
      </section>

      <footer className="onb-actions">
        <button type="button" className="btn-primary" disabled={!stepValid || scanning} onClick={() => draft.step === 3 ? void finishOnboarding() : goTo(draft.step + 1)}>
          {draft.step === 3 ? 'START MY FIRST WEEK' : 'CONTINUE'} <span aria-hidden="true">→</span>
        </button>
        {draft.step === 2 && <button type="button" className="btn-ghost" onClick={() => update({ equipment: ['Bodyweight Only'] })}>Use bodyweight only</button>}
      </footer>
    </main>
  );
}
