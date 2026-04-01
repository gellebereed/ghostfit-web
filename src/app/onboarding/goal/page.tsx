'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const GOALS = [
  { id: 'shredded', icon: '🔥', title: 'Get Shredded', desc: 'Burn fat and get lean' },
  { id: 'muscle', icon: '💪', title: 'Build Muscle', desc: 'Get bigger and stronger' },
  { id: 'strength', icon: '⚡', title: 'Get Stronger', desc: 'Increase raw strength' },
  { id: 'fitness', icon: '🏃', title: 'Improve Fitness', desc: 'Better cardio and endurance' },
];

export default function GoalPage() {
  const router = useRouter();
  const [selected, setSelected] = useState('');
  const [weightKg, setWeightKg] = useState<number>(75);

  function handleNext() {
    sessionStorage.setItem('ghostfit_goal', selected);
    sessionStorage.setItem('ghostfit_weight', weightKg.toString());
    router.push('/onboarding/plan');
  }

  return (
    <div className="page" style={{ paddingBottom: 120 }}>
      <header className="hdr" style={{ background: 'transparent', border: 'none' }}>
        <button className="hdr-back" onClick={() => router.back()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </button>
        <span className="hdr-logo">GHOSTFIT</span>
        <div style={{ width: 20 }} />
      </header>

      <div className="onb-progress">
        <div className="onb-dot active" /> <div className="onb-dot active" /> <div className="onb-dot" />
        <span style={{ marginLeft: 8 }}>2 OF 3</span>
      </div>

      <h1 className="onb-title">What&apos;s your goal?</h1>
      <p className="onb-sub">Your plan will be built around this</p>

      {GOALS.map(g => (
        <div key={g.id} className={`goal-card ${selected === g.id ? 'selected' : ''}`} onClick={() => setSelected(g.id)}>
          <div className="goal-icon">{g.icon}</div>
          <div className="goal-info">
            <h3>{g.title}</h3>
            <p>{g.desc}</p>
          </div>
          <div className="goal-radio" />
        </div>
      ))}

      {selected && (
        <div style={{ marginTop: 32, animation: 'fadeIn 0.5s ease forwards' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Body Weight (kg)</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Optional — used for accurate calorie tracking</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', padding: '16px 20px', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 24 }}>⚖️</span>
            <input 
              type="number" 
              value={weightKg} 
              onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
              placeholder="75"
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 20, fontWeight: 700, outline: 'none' }}
            />
            <span style={{ fontWeight: 600, color: 'var(--text3)' }}>KG</span>
          </div>
        </div>
      )}

      <button className="btn-primary" disabled={!selected} onClick={handleNext} style={{ marginTop: 40 }}>
        Next →
      </button>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
