'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveProfile, savePlan } from '@/lib/db';
import Link from 'next/link';

export default function PlanPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Analyzing your equipment');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    generatePlan();
  }, []);

  async function generatePlan() {
    try {
      const equipment = JSON.parse(sessionStorage.getItem('ghostfit_equipment') || '[]');
      const goal = sessionStorage.getItem('ghostfit_goal') || 'fitness';

      setStatus('Building your workout plan...');
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment, goal }),
      });

      if (!res.ok) throw new Error('Plan generation failed');
      const plan = await res.json();

      setStatus('Saving your plan...');
      await savePlan({ ...plan, createdAt: Date.now() });
      await saveProfile({
        equipment, goal, currentWeek: 1, onboardingComplete: true, createdAt: Date.now(),
        soulCoins: 0, unlockedCosmetics: [], equippedCosmetics: {},
      });

      sessionStorage.removeItem('ghostfit_equipment');
      sessionStorage.removeItem('ghostfit_goal');
      router.replace('/');
    } catch (err) {
      console.error(err);
      setStatus('Error generating plan. Please try again.');
      setFailed(true);
    }
  }

  if (failed) return (
    <div className="plan-loading">
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ color: 'var(--loss-red)' }}>PLAN GENERATION FAILED</h2>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>{status}</p>
      <button className="btn-primary" onClick={() => { setFailed(false); setStatus('Analyzing your equipment'); generatePlan(); }}>
        Try Again
      </button>
      <Link href="/onboarding/goal" className="btn-outline" style={{ marginTop: 12, textDecoration: 'none' }}>
        ← Go Back
      </Link>
    </div>
  );

  return (
    <div className="plan-loading">
      <div className="plan-spinner" />
      <h2>BUILDING <span className="green">YOUR</span> PLAN...</h2>
      <p>{status}</p>
      <p style={{ marginTop: 40, fontSize: 11, color: 'var(--text3)', letterSpacing: 2 }}>THIS ONLY TAKES A MOMENT</p>
    </div>
  );
}
