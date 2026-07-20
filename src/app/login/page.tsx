'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

function getRedirectUrl() {
  return typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';
}

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [earlyEmail, setEarlyEmail] = useState('');
  const [joining, setJoining] = useState(false);
  const [earlyError, setEarlyError] = useState<string | null>(null);
  const [earlySuccess, setEarlySuccess] = useState<string | null>(null);

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
      if (error) setError(error.message);
      else setSuccessMsg('Check your email for a confirmation link!');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError('Invalid email or password.');
      } else {
        window.location.href = '/';
        return;
      }
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email first.');
      return;
    }
    setError(null);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getRedirectUrl()}?next=/login`,
    });
    setSuccessMsg('Password reset link sent to your email.');
  }

  async function handleGoogleLogin() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getRedirectUrl() },
    });
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
        setEarlyError(body.error ?? 'Could not join the list. Try again.');
      } else {
        setEarlySuccess(body.message ?? 'You are in. We will notify you soon.');
        setEarlyEmail('');
      }
    } catch {
      setEarlyError('Could not join the list. Try again.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card" style={{ marginBottom: 16, width: '100%', maxWidth: 420 }}>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>Train harder. Track smarter.</h2>
        <p style={{ color: 'var(--text2)', marginBottom: 12 }}>
          Join early access and get launch updates before public release.
        </p>
        <form onSubmit={handleEarlySignup}>
          <div className="auth-field">
            <input
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={earlyEmail}
              onChange={e => setEarlyEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          {earlyError && <div className="auth-error"><p>{earlyError}</p></div>}
          {earlySuccess && <div className="auth-success"><p>{earlySuccess}</p></div>}
          <button type="submit" className="btn-primary" disabled={joining}>
            {joining ? 'Joining...' : 'Join Early Access'}
          </button>
        </form>
      </div>

      <div className="auth-logo">
        <div className="auth-ghost">Ghost</div>
        <h1 className="auth-title">GHOSTFIT</h1>
        <p className="auth-sub">Beat your past self</p>
      </div>

      <div className="auth-tabs">
        {(['login', 'signup'] as const).map(m => (
          <button
            key={m}
            className={`auth-tab ${mode === m ? 'active' : ''}`}
            onClick={() => {
              setMode(m);
              setError(null);
              setSuccessMsg(null);
            }}
          >
            {m === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        ))}
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label">Email</label>
          <input
            type="email"
            className="auth-input"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label className="auth-label">Password</label>
          <input
            type="password"
            className="auth-input"
            placeholder="Min 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {error && (
          <div className="auth-error">
            <p>{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="auth-success">
            <p>{successMsg}</p>
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        {mode === 'login' && (
          <button type="button" className="auth-forgot" onClick={handleForgotPassword}>
            Forgot password?
          </button>
        )}

        <button type="button" className="btn-secondary" onClick={handleGoogleLogin} disabled={loading} style={{ marginTop: 8 }}>
          Continue with Google
        </button>
      </form>

      <p className="auth-footer">Your data syncs across all your devices once you sign in.</p>
    </div>
  );
}
