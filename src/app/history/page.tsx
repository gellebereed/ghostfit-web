'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAllSessions } from '@/lib/db';
import { GhostSession } from '@/lib/types';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<GhostSession[]>([]);
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses'>('all');

  useEffect(() => {
    getAllSessions().then(setSessions).catch(() => {});
  }, []);

  function getFiltered() {
    if (filter === 'wins') return sessions.filter(s => s.result === 'win');
    if (filter === 'losses') return sessions.filter(s => s.result !== 'win');
    return sessions;
  }

  function groupByDate(list: GhostSession[]): Record<string, GhostSession[]> {
    const g: Record<string, GhostSession[]> = {};
    list.forEach(s => {
      const d = new Date(s.date);
      const today = new Date();
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      let label: string;
      if (d.toDateString() === today.toDateString()) label = 'Today';
      else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
      else label = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      if (!g[label]) g[label] = [];
      g[label].push(s);
    });
    return g;
  }

  const filtered = getFiltered();
  const grouped = groupByDate(filtered);

  return (
    <div style={{ paddingBottom: 100 }}>
      <header className="hdr">
        <Link href="/" className="hdr-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </Link>
        <span style={{ fontSize: 16, fontWeight: 800 }}>Battle History</span>
        <span className="hdr-logo" style={{ fontSize: 12 }}>GHOSTFIT</span>
      </header>

      <div style={{ display: 'flex', gap: 8, padding: '12px 20px' }}>
        <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`chip ${filter === 'wins' ? 'active' : ''}`} onClick={() => setFilter('wins')}>🔥 Wins</button>
        <button className={`chip ${filter === 'losses' ? 'active' : ''}`} onClick={() => setFilter('losses')}>💀 Losses</button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty"><div className="icon">👻</div><h3>No Battles Yet</h3><p>Complete your first exercise to see history</p></div>
      ) : (
        Object.entries(grouped).map(([label, items]) => (
          <div key={label}>
            <div className="date-group"><div className="date-label">{label}</div></div>
            {items.map(s => (
              <div key={s.id} className={`hist-card ${s.result === 'win' ? 'win-border' : s.result === 'loss' ? 'loss-border' : 'inc-border'}`}>
                <div className="hist-badge">{s.result === 'win' ? '🔥' : s.result === 'loss' ? '💀' : '⚡'}</div>
                <div className="hist-info">
                  <h3>{s.exerciseName}</h3>
                  <p>{s.totalReps > 0 ? `${s.totalReps} reps · ${s.setsCompleted} sets` : `${formatTime(s.totalDuration)}`}
                    {s.avgWeight > 0 ? ` · ${s.avgWeight.toFixed(1)}kg avg` : ''}</p>
                </div>
                <div className="hist-time">{new Date(s.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
        ))
      )}

      <nav className="nav">
        <Link href="/" className="nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>HOME
        </Link>
        <Link href="/history" className="nav-item active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>HISTORY
        </Link>
        <Link href="/profile" className="nav-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>PROFILE
        </Link>
      </nav>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
