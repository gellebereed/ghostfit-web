'use client';
import { useEffect, useState } from 'react';
import { UserProfile, getTierLabel } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import { playClick, playWelcomeChime } from '@/lib/sound';

interface WelcomeOverlayProps {
  profile: UserProfile | null;
  streak: number;
  tier: number;
  soulCoins: number;
  battleResult: 'win' | 'loss' | 'none';
}

export default function WelcomeOverlay({ 
  profile, 
  streak, 
  tier, 
  soulCoins, 
  battleResult 
}: WelcomeOverlayProps) {
  const [show, setShow] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const welcomed = sessionStorage.getItem('ghostfit_session_welcomed');
      if (!welcomed) {
        setShow(true);
        // Play welcome chime
        try {
          playWelcomeChime();
        } catch (e) {
          console.warn('Welcome chime playback blocked or failed:', e);
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!show) return null;

  const handleEnter = () => {
    try {
      playClick();
    } catch {}
    setFadeOut(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ghostfit_session_welcomed', 'true');
    }
    setTimeout(() => {
      setShow(false);
    }, 400); // Match globals.css transition time
  };

  const name = profile?.characterName || 'Challenger';
  const tierName = getTierLabel(tier);

  // Customize daily greeting
  let motivation = "Ready to face your past self and push your boundaries today?";
  if (battleResult === 'win') {
    motivation = `🔥 Incredible job yesterday! You beat your ghost. Let's defend your ${streak} day win streak today!`;
  } else if (battleResult === 'loss') {
    motivation = `💀 Yesterday your ghost got the best of you. Today is the perfect day for a rematch and revenge!`;
  } else if (streak > 0) {
    motivation = `⚡ You're on a ${streak} day streak! Keep the flame burning and crush your workout today.`;
  }

  return (
    <div className={`welcome-overlay ${fadeOut ? 'fade-out' : ''}`}>
      <div className="welcome-card">
        <div className="welcome-ghost-container">
          <div 
            className="welcome-ghost-glow" 
            style={{ 
              background: profile?.auraColor 
                ? `radial-gradient(circle, ${profile.auraColor}55 0%, transparent 70%)` 
                : undefined 
            }} 
          />
          <div className="welcome-ghost-emoji">
            <Avatar type="user" size={80} tier={tier} />
          </div>
        </div>

        <h2 className="welcome-title">WELCOME BACK</h2>
        <p className="welcome-subtitle">{name}</p>

        <div className="welcome-stats">
          <div className="welcome-stat-box">
            <div className="welcome-stat-val">🔥 {streak}</div>
            <div className="welcome-stat-lbl">Streak</div>
          </div>
          <div className="welcome-stat-box">
            <div className="welcome-stat-val">⭐ T{tier}</div>
            <div className="welcome-stat-lbl">{tierName}</div>
          </div>
          <div className="welcome-stat-box">
            <div className="welcome-stat-val">🪙 {soulCoins}</div>
            <div className="welcome-stat-lbl">Coins</div>
          </div>
        </div>

        <p className="welcome-motivate">{motivation}</p>

        <button className="welcome-btn" onClick={handleEnter}>
          ENTER THE ARENA ⚡
        </button>
      </div>
    </div>
  );
}
