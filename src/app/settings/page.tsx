'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getProfile, saveProfile, savePlan } from '@/lib/db';
import { getAppSettings, saveSettings } from '@/lib/sound';

const GOALS = [
  { id: 'shredded', icon: '🔥', title: 'Get Shredded' },
  { id: 'muscle', icon: '💪', title: 'Build Muscle' },
  { id: 'strength', icon: '⚡', title: 'Get Stronger' },
  { id: 'fitness', icon: '🏃', title: 'Improve Fitness' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [goal, setGoal] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [hapticOn, setHapticOn] = useState(true);
  const [restStretch, setRestStretch] = useState(true);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const profile = await getProfile();
    if (profile) { setGoal(profile.goal); setEquipment(profile.equipment); }
    const s = getAppSettings();
    setSoundOn(s.soundEnabled);
    setHapticOn(s.hapticEnabled);
    setRestStretch(s.restDayStretch);
  }

  function toggleSound() {
    const v = !soundOn;
    setSoundOn(v);
    saveSettings({ soundEnabled: v, hapticEnabled: hapticOn } as any);
  }
  function toggleHaptic() {
    const v = !hapticOn;
    setHapticOn(v);
    saveSettings({ soundEnabled: soundOn, hapticEnabled: v } as any);
  }
  function toggleRestStretch() {
    const v = !restStretch;
    setRestStretch(v);
    const raw = getAppSettings();
    localStorage.setItem('ghostfit_settings', JSON.stringify({ ...raw, restDayStretch: v }));
  }

  async function changeGoal(newGoal: string) {
    setShowGoalPicker(false);
    if (newGoal === goal) return;
    setGoal(newGoal);
    setShowRegenConfirm(true);
  }

  async function regeneratePlan() {
    setShowRegenConfirm(false);
    setRegenerating(true);
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment, goal }),
      });
      if (res.ok) {
        const plan = await res.json();
        await savePlan({ ...plan, createdAt: Date.now() });
        const profile = await getProfile();
        if (profile) await saveProfile({ ...profile, goal, currentWeek: 1 });
      }
    } catch {}
    setRegenerating(false);
    router.push('/');
  }

  async function resetAll() {
    if (typeof window !== 'undefined') {
      const dbs = await indexedDB.databases?.();
      if (dbs) dbs.forEach(db => { if (db.name) indexedDB.deleteDatabase(db.name); });
      localStorage.clear();
      sessionStorage.clear();
      router.replace('/onboarding');
    }
  }

  if (regenerating) return (
    <div className="plan-loading">
      <div className="plan-spinner" />
      <h2>REBUILDING <span className="green">YOUR</span> PLAN...</h2>
      <p>Adjusting for your new goal</p>
    </div>
  );

  const goalInfo = GOALS.find(g => g.id === goal);

  return (
    <div style={{ paddingBottom: 40 }}>
      <header className="hdr">
        <Link href="/profile" className="hdr-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </Link>
        <span style={{ fontSize: 16, fontWeight: 800 }}>Settings</span>
        <div style={{ width: 20 }} />
      </header>

      {/* Equipment Section */}
      <div className="settings-section">
        <div className="settings-section-title">MY EQUIPMENT</div>
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Your workout plan is built around these</p>
        <Link href="/settings/equipment" className="settings-row" style={{ textDecoration: 'none' }}>
          <div className="row-left">🏋️ Edit Equipment ({equipment.length})</div>
          <div className="row-right">→</div>
        </Link>
      </div>

      {/* Plan Section */}
      <div className="settings-section">
        <div className="settings-section-title">WORKOUT PLAN</div>
        <Link href="/plan" className="settings-row" style={{ textDecoration: 'none' }}>
          <div className="row-left">✏️ My Workout Plan</div>
          <div className="row-right">→</div>
        </Link>
      </div>

      {/* Goal Section */}
      <div className="settings-section">
        <div className="settings-section-title">MY GOAL</div>
        <div className="settings-row" onClick={() => setShowGoalPicker(true)}>
          <div className="row-left">{goalInfo?.icon} {goalInfo?.title || 'Set Goal'}</div>
          <div className="row-right">Change →</div>
        </div>
      </div>

      {/* Preferences */}
      <div className="settings-section">
        <div className="settings-section-title">PREFERENCES</div>
        <div className="settings-row">
          <div className="row-left">🔊 Sound Effects</div>
          <div className={`toggle ${soundOn ? 'on' : ''}`} onClick={toggleSound} />
        </div>
        <div className="settings-row">
          <div className="row-left">📳 Haptic Feedback</div>
          <div className={`toggle ${hapticOn ? 'on' : ''}`} onClick={toggleHaptic} />
        </div>
        <div className="settings-row">
          <div className="row-left">🌙 Rest Day Stretch</div>
          <div className={`toggle ${restStretch ? 'on' : ''}`} onClick={toggleRestStretch} />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="settings-section">
        <div className="settings-section-title" style={{ color: 'var(--loss-red)' }}>DANGER ZONE</div>
        <button className="danger-btn" onClick={() => setShowResetConfirm(true)}>Reset All Data</button>
      </div>

      {/* Goal Picker Modal */}
      {showGoalPicker && (
        <div className="dialog-overlay" onClick={() => setShowGoalPicker(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: 350 }}>
            <h3>Change Goal</h3>
            <p>This will generate a new plan</p>
            {GOALS.map(g => (
              <div key={g.id} className={`goal-card ${goal === g.id ? 'selected' : ''}`} onClick={() => changeGoal(g.id)} style={{ marginBottom: 8 }}>
                <div className="goal-icon">{g.icon}</div>
                <div className="goal-info"><h3>{g.title}</h3></div>
                <div className="goal-radio" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regen Confirm */}
      {showRegenConfirm && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Generate New Plan?</h3>
            <p>Changing your goal will generate a new workout plan. Your battle history is preserved.</p>
            <div className="dialog-btns">
              <button className="give-up" onClick={() => setShowRegenConfirm(false)}>Cancel</button>
              <button className="keep" onClick={regeneratePlan}>Generate →</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirm */}
      {showResetConfirm && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>⚠️ Reset Everything?</h3>
            <p>This will delete all workout data, battle history, and settings. This cannot be undone.</p>
            <div className="dialog-btns">
              <button className="keep" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="give-up" onClick={resetAll}>Reset All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
