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
      if (error) setError('Invalid email or password.');
      // Middleware handles redirect to / on success
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

      {/* Google Login */}
      <button 
        type="button" 
        className="auth-google-btn" 
        onClick={handleGoogleLogin} 
        disabled={loading}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <div className="auth-divider">
        <span>or</span>
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
