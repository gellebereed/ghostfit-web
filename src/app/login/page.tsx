'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

function getRedirectUrl() {
  // If we are in the browser, always use the current origin
  return typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';
}

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
        // Redirect immediately on success
        window.location.href = '/';
        return;
      }
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) { setError('Enter your email first.'); return; }
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
    // OAuth handles the redirect, no local setLoading(false) needed unless it fails immediately
  }

  return (
    <div className="auth-page">
      {/* Logo */}
      <div className="auth-logo">
        <div className="auth-ghost">👻</div>
        <h1 className="auth-title">GHOSTFIT</h1>
        <p className="auth-sub">Beat your past self</p>
      </div>

      {/* Tab switcher */}
      <div className="auth-tabs">
        {(['login', 'signup'] as const).map(m => (
          <button
            key={m}
            className={`auth-tab ${mode === m ? 'active' : ''}`}
            onClick={() => { setMode(m); setError(null); setSuccessMsg(null); }}
          >
            {m === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
        ))}
      </div>

      {/* Form */}
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

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          style={{ marginTop: 4 }}
        >
          {loading ? '…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        {mode === 'login' && (
          <button
            type="button"
            className="auth-forgot"
            onClick={handleForgotPassword}
          >
            Forgot password?
          </button>
        )}
      </form>

      <p className="auth-footer">
        Your data syncs across all your devices once you sign in.
      </p>
    </div>
  );
}
