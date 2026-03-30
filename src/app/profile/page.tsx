'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getWinCount, getStreak, getAllSessions, getProfile } from '@/lib/db';
import { calculateTier, getTierLabel, TIER_THRESHOLDS } from '@/lib/types';
import { getAvatarPrefs, getCharEmoji } from '@/lib/avatar';
import { EQUIPMENT_ICONS } from '@/lib/equipment-icons';
import { supabase } from '@/lib/supabase';

async function signOut() {
  await supabase.auth.signOut();
}

export default function ProfilePage() {
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [streak, setStreakVal] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [tier, setTier] = useState(1);
  const [goal, setGoal] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const sessions = await getAllSessions();
    const w = sessions.filter(s => s.result === 'win').length;
    const l = sessions.filter(s => s.result !== 'win').length;
    setWins(w); setLosses(l); setTier(calculateTier(w));
    const s = await getStreak(); setStreakVal(s);
    const totalSec = sessions.reduce((acc, s) => acc + (s.totalDuration || s.setsCompleted * 120), 0);
    setTotalTime(Math.round(totalSec / 3600 * 10) / 10);
    const profile = await getProfile();
    if (profile) { setGoal(profile.goal); setEquipment(profile.equipment); }
  }

  const avatar = getAvatarPrefs();
  const nextTierThreshold = TIER_THRESHOLDS[tier] || 25;
  const prevTierThreshold = TIER_THRESHOLDS[tier - 1] || 0;
  const progress = tier >= 5 ? 100 : Math.min(100, ((wins - prevTierThreshold) / (nextTierThreshold - prevTierThreshold)) * 100);

  return (
    <div style={{ paddingBottom: 100 }}>
      <header className="hdr">
        <Link href="/" className="hdr-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </Link>
        <span style={{ fontSize: 16, fontWeight: 800 }}>Profile</span>
        {/* Upgrade 4: Settings gear icon */}
        <Link href="/settings" style={{ color: 'var(--text2)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </Link>
      </header>

      <div className="profile-header">
        <div className={`profile-char t${tier}`} style={{ background: avatar.yourAuraColor, boxShadow: `0 0 30px ${avatar.yourAuraColor}40` }}>
          {getCharEmoji(avatar.yourCharacterStyle)}
        </div>
        <div className="profile-tier">Tier {tier} {getTierLabel(tier)}</div>
        <div className="profile-tier-bar">
          <div className="profile-tier-fill" style={{ width: `${progress}%`, background: avatar.yourAuraColor }} />
        </div>
        <p style={{ fontSize: 12, color: 'var(--text2)' }}>
          {tier < 5 ? `${nextTierThreshold - wins} more wins to Tier ${tier + 1}` : 'Max tier reached! 👑'}
        </p>
      </div>

      {/* Upgrade 3: Customize Avatar card */}
      <div style={{ padding: '0 20px', marginBottom: 16 }}>
        <Link href="/avatar" className="settings-row" style={{ textDecoration: 'none' }}>
          <div className="row-left">🎨 Customize Avatar</div>
          <div className="row-right">→</div>
        </Link>
      </div>

      <div className="stats-row">
        <div className="stat-box"><div className="emoji">👻</div><div className="val">{wins}</div><div className="lbl">Ghosts Beaten</div></div>
        <div className="stat-box"><div className="emoji">💀</div><div className="val">{losses}</div><div className="lbl">Times Beaten</div></div>
      </div>
      <div className="stats-row">
        <div className="stat-box"><div className="emoji">🔥</div><div className="val">{streak}</div><div className="lbl">Win Streak</div></div>
        <div className="stat-box"><div className="emoji">⏱</div><div className="val">{totalTime}</div><div className="lbl">Hours Trained</div></div>
      </div>

      {goal && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Current Goal</div>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{goal === 'shredded' ? '🔥' : goal === 'muscle' ? '💪' : goal === 'strength' ? '⚡' : '🏃'}</span>
            <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{goal.replace('shredded', 'Get Shredded').replace('muscle', 'Build Muscle').replace('strength', 'Get Stronger').replace('fitness', 'Improve Fitness')}</span>
          </div>
        </div>
      )}

      {/* Upgrade 1: Equipment Image Cards */}
      {equipment.length > 0 && (
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Equipment</div>
          <div className="equip-card-grid">
            {equipment.map(e => (
              <div key={e} className="equip-card selected">
                <svg className="eqicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={EQUIPMENT_ICONS[e] || EQUIPMENT_ICONS['Bodyweight Only']} />
                </svg>
                <span className="eqname">{e}</span>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Sign Out */}
      <div style={{ padding: '16px 20px 28px' }}>
        <button onClick={signOut} className="auth-signout-btn">
          Sign Out
        </button>
      </div>

      <nav className="nav">
        <Link href="/" className="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>HOME</Link>
        <Link href="/history" className="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>HISTORY</Link>
        <Link href="/profile" className="nav-item active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>PROFILE</Link>
      </nav>
    </div>
  );
}
