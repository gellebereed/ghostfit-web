'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NamePage() {
  const router = useRouter();
  const [name, setName] = useState('');

  function handleNext() {
    if (!name.trim()) return;
    sessionStorage.setItem('ghostfit_name', name.trim());
    router.push('/onboarding/equipment');
  }

  return (
    <div className="page" style={{ paddingTop: 10 }}>
      <header className="hdr" style={{ background: 'transparent', border: 'none', justifyContent: 'center', padding: '0 0 20px 0' }}>
        <span className="hdr-logo">GHOSTFIT</span>
      </header>

      <div className="onb-progress">
        <div className="onb-dot active" /> <div className="onb-dot" /> <div className="onb-dot" />
        <span style={{ marginLeft: 8 }}>1 OF 3</span>
      </div>

      <h1 className="onb-title">Welcome, Fighter.<br /><span className="green">What is your name?</span></h1>
      <p className="onb-sub">We will use this to track your stats and battle record.</p>

      <div style={{ marginTop: 40, animation: 'fadeIn 0.5s ease forwards' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12, 
          background: 'var(--surface)', 
          padding: '16px 20px', 
          borderRadius: 'var(--r)', 
          border: '1px solid var(--border)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
          transition: 'border-color 0.25s'
        }}
        className="name-input-container"
        >
          <span style={{ fontSize: 24 }}>🥷</span>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value.toUpperCase())}
            placeholder="ENTER YOUR NAME"
            maxLength={10}
            autoFocus
            style={{ 
              flex: 1, 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text)', 
              fontSize: 20, 
              fontWeight: 800, 
              outline: 'none',
              letterSpacing: '1px'
            }}
          />
        </div>
        <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 10, letterSpacing: '0.5px' }}>
          MAXIMUM 10 CHARACTERS
        </p>
      </div>

      <button 
        className="btn-primary" 
        disabled={!name.trim()} 
        onClick={handleNext} 
        style={{ marginTop: 60 }}
      >
        Next →
      </button>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .name-input-container:focus-within {
          border-color: var(--accent) !important;
          box-shadow: 0 0 15px rgba(0, 255, 135, 0.15) !important;
        }
      `}</style>
    </div>
  );
}
