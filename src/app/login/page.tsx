'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

function getRedirectUrl() {
  return typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';
}

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'auth' | 'waitlist'>('auth');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Early access state
  const [earlyEmail, setEarlyEmail] = useState('');
  const [joining, setJoining] = useState(false);
  const [earlyError, setEarlyError] = useState<string | null>(null);
  const [earlySuccess, setEarlySuccess] = useState<string | null>(null);

  // Password strength checker
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'transparent' };
    if (pass.length < 6) return { score: 1, label: 'Too short', color: '#ff4444' };
    let score = 1;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    
    if (score <= 2) return { score: 2, label: 'Weak', color: '#ffbb33' };
    if (score === 3) return { score: 3, label: 'Good', color: '#00C851' };
    return { score: 4, label: 'Strong', color: '#00FF87' };
  };

  const strength = getPasswordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: getRedirectUrl() },
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccessMsg('Check your email for a confirmation link to activate your account!');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError('Invalid credentials. Please check your email and password.');
      } else {
        window.location.href = '/';
        return;
      }
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getRedirectUrl()}?next=/login`,
    });
    if (error) {
      setError(error.message);
    } else {
      setSuccessMsg('Password reset instructions sent to your email.');
    }
  }

  async function handleEarlySignup(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    setEarlyError(null);
    setEarlySuccess(null);

    try {
      const response = await fetch('/api/landing-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: earlyEmail }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string; message?: string };
      if (!response.ok || !body.ok) {
        setEarlyError(body.error ?? 'Could not join list. Please try again.');
      } else {
        setEarlySuccess(body.message ?? 'You are locked in! We will notify you at release.');
        setEarlyEmail('');
      }
    } catch {
      setEarlyError('Connection error. Please try again.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="login-portal">
      {/* Ambient background glowing mesh */}
      <div className="portal-glow-bg">
        <div className="glow-orb orb-1" />
        <div className="glow-orb orb-2" />
        <div className="grid-overlay" />
      </div>

      <main className="portal-container">
        {/* Logo & Branding Header */}
        <header className="portal-header">
          <div className="portal-logo-wrapper">
            <svg className="portal-logo-svg" viewBox="0 0 512 512" width="64" height="64">
              <path d="M 256 100 C 170 100, 130 160, 130 250 L 130 370 L 172 340 L 214 370 L 256 340 L 298 370 L 340 340 L 382 370 L 382 250 C 382 160, 342 100, 256 100 Z" fill="url(#portalGhostGrad)" />
              <path d="M 185 210 Q 220 230 235 240 Q 210 248 180 240 Z" fill="#0A0A0A" />
              <path d="M 327 210 Q 292 230 277 240 Q 302 248 332 240 Z" fill="#0A0A0A" />
              <circle cx="210" cy="232" r="6" fill="#00FF87" />
              <circle cx="302" cy="232" r="6" fill="#00FF87" />
              <defs>
                <linearGradient id="portalGhostGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00FF87" />
                  <stop offset="100%" stopColor="#60EFFF" />
                </linearGradient>
              </defs>
            </svg>
            <div className="logo-pulse-ring" />
          </div>

          <h1 className="portal-title">
            GHOST<span className="title-accent">FIT</span>
          </h1>
          <p className="portal-subtitle">BATTLE YOUR PAST SELF • DOMINATE YOUR FUTURE</p>
        </header>

        {/* Main Portal Card */}
        <div className="portal-card">
          {/* Main Mode Navigation (Auth vs Waitlist) */}
          <div className="portal-nav-pills">
            <button
              className={`nav-pill ${activeTab === 'auth' ? 'active' : ''}`}
              onClick={() => setActiveTab('auth')}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
              </svg>
              <span>Arena Access</span>
            </button>
            <button
              className={`nav-pill ${activeTab === 'waitlist' ? 'active' : ''}`}
              onClick={() => setActiveTab('waitlist')}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Early Beta</span>
            </button>
          </div>

          {activeTab === 'auth' ? (
            <div className="auth-tab-content">
              {/* Sub Mode Selector (Sign In vs Sign Up) */}
              <div className="sub-mode-toggle">
                <button
                  className={`sub-toggle-btn ${mode === 'login' ? 'active' : ''}`}
                  onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
                >
                  Sign In
                </button>
                <button
                  className={`sub-toggle-btn ${mode === 'signup' ? 'active' : ''}`}
                  onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
                >
                  Create Account
                </button>
              </div>

              <form className="portal-form" onSubmit={handleSubmit}>
                {/* Email Field */}
                <div className="form-group">
                  <label className="form-label">ACCOUNT EMAIL</label>
                  <div className="input-icon-wrapper">
                    <svg className="input-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <input
                      type="email"
                      className="portal-input"
                      placeholder="athlete@ghostfit.app"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="form-group">
                  <div className="label-row">
                    <label className="form-label">PASSWORD</label>
                    {mode === 'login' && (
                      <button type="button" className="forgot-link" onClick={handleForgotPassword}>
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="input-icon-wrapper">
                    <svg className="input-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="portal-input"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      className="pass-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicator (On Signup) */}
                  {mode === 'signup' && password.length > 0 && (
                    <div className="strength-meter">
                      <div className="strength-bars">
                        {[1, 2, 3, 4].map(idx => (
                          <div
                            key={idx}
                            className={`strength-bar ${idx <= strength.score ? 'active' : ''}`}
                            style={{ backgroundColor: idx <= strength.score ? strength.color : undefined }}
                          />
                        ))}
                      </div>
                      <span className="strength-text" style={{ color: strength.color }}>
                        {strength.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status Messages */}
                {error && (
                  <div className="portal-alert error">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="portal-alert success">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Primary Submit Button */}
                <button type="submit" className="portal-submit-btn" disabled={loading}>
                  {loading ? (
                    <span className="spinner" />
                  ) : mode === 'login' ? (
                    <>
                      <span>ENTER THE ARENA</span>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  ) : (
                    <>
                      <span>INITIALIZE ATHLETE</span>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>


              </form>
            </div>
          ) : (
            <div className="waitlist-tab-content">
              <div className="waitlist-badge">
                <span className="badge-dot" />
                <span>LIMITED EARLY SLOTS</span>
              </div>
              <h2 className="waitlist-heading">Claim Early Access</h2>
              <p className="waitlist-desc">
                Get first access to AI Ghost battles, priority server access, and an exclusive Founders Avatar skin at launch.
              </p>

              <form onSubmit={handleEarlySignup} className="portal-form">
                <div className="form-group">
                  <label className="form-label">YOUR EMAIL</label>
                  <div className="input-icon-wrapper">
                    <svg className="input-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <input
                      type="email"
                      className="portal-input"
                      placeholder="founder@example.com"
                      value={earlyEmail}
                      onChange={e => setEarlyEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                {earlyError && (
                  <div className="portal-alert error">
                    <span>{earlyError}</span>
                  </div>
                )}

                {earlySuccess && (
                  <div className="portal-alert success">
                    <span>{earlySuccess}</span>
                  </div>
                )}

                <button type="submit" className="portal-submit-btn" disabled={joining}>
                  {joining ? (
                    <span className="spinner" />
                  ) : (
                    <>
                      <span>JOIN WAITLIST NOW</span>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Feature Highlights Ticker */}
        <footer className="portal-features">
          <div className="feature-item">
            <span className="feature-icon">⚔️</span>
            <div className="feature-text">
              <strong>Ghost Battles</strong>
              <span>Compete with your past reps</span>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">⚡</span>
            <div className="feature-text">
              <strong>Smart Scaling</strong>
              <span>AI progressive overload</span>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🪙</span>
            <div className="feature-text">
              <strong>Soul Rewards</strong>
              <span>Earn gear & badges</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
