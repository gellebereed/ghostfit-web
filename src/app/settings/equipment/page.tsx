'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getProfile, saveProfile, savePlan, getCurrentPlan } from '@/lib/db';
import { EQUIPMENT_ICONS, ALL_EQUIPMENT } from '@/lib/equipment-icons';

export default function EquipmentEditorPage() {
  const router = useRouter();
  const [equipment, setEquipment] = useState<string[]>([]);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [search, setSearch] = useState('');
  const [snackbar, setSnackbar] = useState<{ text: string; undoItem: string } | null>(null);
  const [showRegenBanner, setShowRegenBanner] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const profile = await getProfile();
    if (profile) setEquipment(profile.equipment);
  }

  async function removeItem(item: string) {
    const newEquip = equipment.filter(e => e !== item);
    setEquipment(newEquip);
    await persistEquipment(newEquip);
    setSnackbar({ text: `${item} removed.`, undoItem: item });
    setTimeout(() => setSnackbar(null), 5000);
    setShowRegenBanner(true);
  }

  async function undoRemove() {
    if (!snackbar) return;
    const newEquip = [...equipment, snackbar.undoItem];
    setEquipment(newEquip);
    await persistEquipment(newEquip);
    setSnackbar(null);
  }

  async function addItem(item: string) {
    if (equipment.includes(item)) return;
    const newEquip = [...equipment, item];
    setEquipment(newEquip);
    await persistEquipment(newEquip);
    setShowAddSheet(false);
    setShowRegenBanner(true);
  }

  async function persistEquipment(equip: string[]) {
    const profile = await getProfile();
    if (profile) await saveProfile({ ...profile, equipment: equip });
  }

  async function regeneratePlan() {
    setRegenerating(true);
    const profile = await getProfile();
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment, goal: profile?.goal || 'fitness' }),
      });
      if (res.ok) {
        const plan = await res.json();
        await savePlan({ ...plan, createdAt: Date.now() });
        if (profile) await saveProfile({ ...profile, equipment, currentWeek: 1 });
      }
    } catch {}
    setRegenerating(false);
    setShowRegenBanner(false);
    router.push('/');
  }

  if (regenerating) return (
    <div className="plan-loading">
      <div className="plan-spinner" /><h2>REBUILDING <span className="green">YOUR</span> PLAN...</h2><p>Adapting to your new equipment</p>
    </div>
  );

  const available = ALL_EQUIPMENT.filter(e => !equipment.includes(e) && e.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ paddingBottom: 100 }}>
      <header className="hdr">
        <Link href="/settings" className="hdr-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </Link>
        <span style={{ fontSize: 16, fontWeight: 800 }}>My Equipment</span>
        <div style={{ width: 20 }} />
      </header>

      {showRegenBanner && (
        <div className="banner">
          <span style={{ flex: 1 }}>Equipment changed. Regenerate plan?</span>
          <button onClick={() => setShowRegenBanner(false)} style={{ background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border)' }}>Keep</button>
          <button onClick={regeneratePlan}>New Plan →</button>
        </div>
      )}

      <div style={{ padding: '8px 20px' }}>
        <div className="equip-card-grid">
          {equipment.map(e => (
            <div key={e} className="equip-card selected">
              <svg className="eqicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={EQUIPMENT_ICONS[e] || EQUIPMENT_ICONS['Bodyweight Only']} />
              </svg>
              <span className="eqname">{e}</span>
              <button className="eq-remove" onClick={() => removeItem(e)}>×</button>
            </div>
          ))}
        </div>

        <button className="btn-outline" onClick={() => { setShowAddSheet(true); setSearch(''); }} style={{ marginTop: 12 }}>
          + Add Equipment
        </button>
      </div>

      {/* Snackbar */}
      {snackbar && (
        <div className="snackbar">
          {snackbar.text} <button onClick={undoRemove}>Undo</button>
        </div>
      )}

      {/* Add Bottom Sheet */}
      {showAddSheet && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setShowAddSheet(false)} />
          <div className="bottom-sheet">
            <input className="search-input" placeholder="Search equipment..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            {available.map(e => (
              <div key={e} className="search-result" onClick={() => addItem(e)}>
                <span>{e}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
            ))}
            {available.length === 0 && <div className="empty" style={{ padding: 20 }}><p>No matching equipment</p></div>}
          </div>
        </>
      )}
    </div>
  );
}
