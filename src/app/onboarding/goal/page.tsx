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

  function handleNext() {
    sessionStorage.setItem('ghostfit_goal', selected);
    router.push('/onboarding/plan');
  }

  return (
    <div className="page">
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

      <button className="btn-primary" disabled={!selected} onClick={handleNext} style={{ marginTop: 24 }}>
        Next →
      </button>
    </div>
  );
}
