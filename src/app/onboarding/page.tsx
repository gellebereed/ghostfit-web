'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { EQUIPMENT_ICONS, ALL_EQUIPMENT } from '@/lib/equipment-icons';

export default function EquipmentPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [showList, setShowList] = useState(false);
  const [scanning, setScanning] = useState(false);

  function toggle(item: string) {
    setEquipment(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await fetch('/api/vision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const data = await resp.json();
      if (data.equipment?.length) {
        setEquipment(prev => [...new Set([...prev, ...data.equipment])]);
      }
    } catch {}
    setScanning(false);
  }

  function handleNext() {
    sessionStorage.setItem('ghostfit_equipment', JSON.stringify(equipment));
    router.push('/onboarding/goal');
  }

  return (
    <div className="page">
      <div className="onb-progress">
        1 OF 3 <div className="onb-dot active" /> <div className="onb-dot" /> <div className="onb-dot" />
      </div>

      <h1 className="onb-title">What equipment<br /><span className="green">do you have?</span></h1>
      <p className="onb-sub">We&apos;ll build your plan around what you actually own.</p>

      <div className="onb-options">
        <div className="onb-option" onClick={() => fileRef.current?.click()}>
          <div className="icon">📷</div>
          <h3>Take a Photo</h3>
          <p>Point at your equipment</p>
        </div>
        <div className="onb-option" onClick={() => setShowList(!showList)}>
          <div className="icon">☰</div>
          <h3>Pick from List</h3>
          <p>Choose manually</p>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="camera-input" onChange={handlePhoto} />

      {scanning && <div className="loading"><div className="loader" /><p style={{marginTop: 12, color: 'var(--text2)'}}>AI scanning equipment...</p></div>}

      {/* Upgrade 1: Equipment Image Cards in 3-column grid */}
      {showList && (
        <div className="equip-card-grid">
          {ALL_EQUIPMENT.map(e => (
            <div key={e} className={`equip-card ${equipment.includes(e) ? 'selected' : ''}`} onClick={() => toggle(e)}>
              <svg className="eqicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={EQUIPMENT_ICONS[e] || EQUIPMENT_ICONS['Bodyweight Only']} />
              </svg>
              <span className="eqname">{e}</span>
              {equipment.includes(e) && <span className="eq-check">✓</span>}
            </div>
          ))}
        </div>
      )}

      {equipment.length > 0 && (
        <>
          <div className="equip-label">Current Inventory ({equipment.length})</div>
          <div className="equip-card-grid">
            {equipment.map(e => (
              <div key={e} className="equip-card selected">
                <svg className="eqicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={EQUIPMENT_ICONS[e] || EQUIPMENT_ICONS['Bodyweight Only']} />
                </svg>
                <span className="eqname">{e}</span>
                <button className="eq-remove" onClick={(ev) => { ev.stopPropagation(); toggle(e); }}>×</button>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="btn-primary" disabled={equipment.length === 0} onClick={handleNext} style={{ marginTop: 24 }}>
        Next →
      </button>
    </div>
  );
}
