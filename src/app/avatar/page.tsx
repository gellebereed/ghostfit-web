'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAvatarPrefs, saveAvatarPrefs, CHARACTER_STYLES, YOUR_AURA_COLORS, GHOST_AURA_COLORS, AvatarPrefs } from '@/lib/avatar';
import { calculateTier } from '@/lib/types';
import { getWinCount } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { useEffect } from 'react';

// ---- Image compression + Supabase Storage upload ----
async function uploadAvatarPhoto(file: File, type: 'user' | 'ghost'): Promise<string | null> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Compress image client-side to 256x256 JPEG blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        const size = Math.min(img.width, img.height);
        const x = (img.width - size) / 2;
        const y = (img.height - size) / 2;
        ctx.drawImage(img, x, y, size, size, 0, 0, 256, 256);
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Canvas blob failed')), 'image/jpeg', 0.8);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Upload to Supabase Storage
  const path = `${user.id}/${type}-avatar.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (uploadError) {
    console.error('Avatar upload error:', uploadError);
    return null;
  }

  // Get a long-lived signed URL (1 year)
  const { data: signedData } = await supabase.storage
    .from('avatars')
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  return signedData?.signedUrl ?? null;
}

export default function AvatarPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'you' | 'ghost'>('you');
  const [prefs, setPrefs] = useState<AvatarPrefs>(getAvatarPrefs());
  const [tier, setTier] = useState(1);
  const [saved, setSaved] = useState(false);
  const userInputRef = useRef<HTMLInputElement>(null);
  const ghostInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getWinCount().then(w => setTier(calculateTier(w)));
  }, []);

  function update(key: keyof AvatarPrefs, value: string | boolean | null) {
    setPrefs(prev => ({ ...prev, [key]: value }));
  }

  async function handlePhotoUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'user' | 'ghost'
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadAvatarPhoto(file, type);
      if (!url) return;
      if (type === 'user') {
        setPrefs(prev => ({ ...prev, yourPhotoUrl: url, yourUsesPhoto: true }));
      } else {
        setPrefs(prev => ({ ...prev, ghostPhotoUrl: url, ghostUsesPhoto: true }));
      }
    } catch (err) {
      console.error('Photo upload failed', err);
    }
  }

  function removePhoto(type: 'user' | 'ghost') {
    if (type === 'user') {
      setPrefs(prev => ({ ...prev, yourPhotoUrl: null, yourUsesPhoto: false }));
    } else {
      setPrefs(prev => ({ ...prev, ghostPhotoUrl: null, ghostUsesPhoto: false }));
    }
  }

  function save() {
    saveAvatarPrefs(prefs);
    setSaved(true);
    setTimeout(() => router.push('/profile'), 800);
  }

  // Which photo to show in the preview
  const yourPreviewPhoto = prefs.yourUsesPhoto && prefs.yourPhotoUrl;
  const ghostPreviewPhoto = prefs.ghostUsesPhoto && prefs.ghostPhotoUrl;

  return (
    <div style={{ paddingBottom: 100 }}>
      <header className="hdr">
        <Link href="/profile" className="hdr-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </Link>
        <span style={{ fontSize: 16, fontWeight: 800 }}>Customize Your Fighter</span>
        <div style={{ width: 20 }} />
      </header>

      {/* Tabs */}
      <div className="avatar-tabs">
        <button className={`avatar-tab ${tab === 'you' ? 'active' : ''}`} onClick={() => setTab('you')}>Your Character</button>
        <button className={`avatar-tab ${tab === 'ghost' ? 'active' : ''}`} onClick={() => setTab('ghost')}>Your Ghost</button>
      </div>

      {tab === 'you' ? (
        <>
          {/* ---- Photo Upload — YOUR CHARACTER ---- */}
          <div className="av-section">
            <div className="av-section-title">Your Photo</div>
            <div className="av-photo-row">
              <label className="av-photo-label" htmlFor="user-photo-input">
                <div className={`av-photo-circle ${prefs.yourUsesPhoto ? 'av-photo-active' : 'av-photo-empty'}`}>
                  {prefs.yourUsesPhoto && prefs.yourPhotoUrl
                    ? <img src={prefs.yourPhotoUrl} alt="Your avatar" className="av-photo-img" />
                    : <span className="av-photo-icon">📷</span>}
                </div>
              </label>
              <input
                id="user-photo-input"
                ref={userInputRef}
                type="file"
                accept="image/*"
                className="av-photo-input"
                onChange={e => handlePhotoUpload(e, 'user')}
              />
              <div className="av-photo-info">
                <p className={`av-photo-title ${prefs.yourUsesPhoto ? 'green' : ''}`}>
                  {prefs.yourUsesPhoto ? 'Photo set ✓' : 'Upload your photo'}
                </p>
                <p className="av-photo-sub">Your face in the battle arena</p>
                {prefs.yourUsesPhoto && (
                  <button className="av-photo-remove" onClick={() => removePhoto('user')}>Remove photo</button>
                )}
              </div>
            </div>
            {/* Divider */}
            <div className="av-divider">
              <div className="av-divider-line" />
              <span className="av-divider-text">or choose a character</span>
              <div className="av-divider-line" />
            </div>
          </div>

          {/* Character Style */}
          <div className="av-section">
            <div className="av-section-title">Character Style</div>
            <div className="char-row">
              {CHARACTER_STYLES.map(c => (
                <div key={c.id} className={`char-option ${prefs.yourCharacterStyle === c.id ? 'selected' : ''}`} onClick={() => update('yourCharacterStyle', c.id)}>
                  <span className="char-emoji">{c.emoji}</span>
                  <span className="char-name">{c.name}</span>
                  {prefs.yourCharacterStyle === c.id && <div className="char-check">✓</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Aura Color */}
          <div className="av-section">
            <div className="av-section-title">Aura Color</div>
            <div className="color-row">
              {YOUR_AURA_COLORS.map(c => {
                const locked = c.minTier && tier < c.minTier;
                return (
                  <div key={c.color} className={`color-btn ${prefs.yourAuraColor === c.color ? 'selected' : ''}`}
                    style={{ background: c.color }}
                    onClick={() => !locked && update('yourAuraColor', c.color)}>
                    {locked && <div className="lock">🔒</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div className="av-section">
            <div className="av-section-title">Fighter Name</div>
            <input className="name-input" maxLength={10} value={prefs.yourCharacterName}
              onChange={e => update('yourCharacterName', e.target.value.toUpperCase())} placeholder="YOU" />
          </div>
        </>
      ) : (
        <>
          {/* ---- Photo Upload — YOUR GHOST ---- */}
          <div className="av-section">
            <div className="av-section-title">Rival Photo</div>
            <div className="av-photo-row">
              <label className="av-photo-label" htmlFor="ghost-photo-input">
                <div className={`av-photo-circle ${prefs.ghostUsesPhoto ? 'av-photo-active av-photo-ghost' : 'av-photo-empty'}`}>
                  {prefs.ghostUsesPhoto && prefs.ghostPhotoUrl
                    ? <img src={prefs.ghostPhotoUrl} alt="Ghost avatar" className="av-photo-img av-photo-ghost-img" />
                    : <span className="av-photo-icon">📷</span>}
                </div>
              </label>
              <input
                id="ghost-photo-input"
                ref={ghostInputRef}
                type="file"
                accept="image/*"
                className="av-photo-input"
                onChange={e => handlePhotoUpload(e, 'ghost')}
              />
              <div className="av-photo-info">
                <p className={`av-photo-title ${prefs.ghostUsesPhoto ? 'green' : ''}`}>
                  {prefs.ghostUsesPhoto ? 'Rival set ✓' : 'Upload someone to beat 😏'}
                </p>
                <p className="av-photo-sub">Their ghost haunts the arena</p>
                {prefs.ghostUsesPhoto && (
                  <button className="av-photo-remove" onClick={() => removePhoto('ghost')}>Remove photo</button>
                )}
              </div>
            </div>
            {/* Divider */}
            <div className="av-divider">
              <div className="av-divider-line" />
              <span className="av-divider-text">or choose a ghost</span>
              <div className="av-divider-line" />
            </div>
          </div>

          {/* Ghost Character Style */}
          <div className="av-section">
            <div className="av-section-title">Ghost Style</div>
            <div className="char-row">
              {CHARACTER_STYLES.map(c => (
                <div key={c.id} className={`char-option ${prefs.ghostCharacterStyle === c.id ? 'selected' : ''}`}
                  style={{ opacity: 0.6 }} onClick={() => update('ghostCharacterStyle', c.id)}>
                  <span className="char-emoji">{c.emoji}</span>
                  <span className="char-name">{c.name}</span>
                  {prefs.ghostCharacterStyle === c.id && <div className="char-check">✓</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Ghost Aura Color */}
          <div className="av-section">
            <div className="av-section-title">Ghost Aura</div>
            <div className="color-row">
              {GHOST_AURA_COLORS.map(c => (
                <div key={c.color} className={`color-btn ${prefs.ghostAuraColor === c.color ? 'selected' : ''}`}
                  style={{ background: c.color }} onClick={() => update('ghostAuraColor', c.color)} />
              ))}
            </div>
          </div>

          {/* Ghost Name */}
          <div className="av-section">
            <div className="av-section-title">Ghost Name</div>
            <input className="name-input" maxLength={10} value={prefs.ghostCharacterName}
              onChange={e => update('ghostCharacterName', e.target.value.toUpperCase())} placeholder="GHOST" />
            <div className="name-hint">Try &quot;MARCH ME&quot; or &quot;LAZY YOU&quot; 😏</div>
          </div>
        </>
      )}

      {/* Preview */}
      <div className="av-section" style={{ textAlign: 'center' }}>
        <div className="av-section-title">Preview</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '12px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: prefs.yourAuraColor, boxShadow: `0 0 15px ${prefs.yourAuraColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, overflow: 'hidden' }}>
              {yourPreviewPhoto
                ? <img src={prefs.yourPhotoUrl!} alt="You" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : CHARACTER_STYLES.find(c => c.id === prefs.yourCharacterStyle)?.emoji}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text2)' }}>{prefs.yourCharacterName}</span>
          </div>
          <span style={{ fontSize: 16, fontWeight: 900, opacity: 0.5 }}>VS</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: `${prefs.ghostAuraColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, opacity: 0.6, overflow: 'hidden' }}>
              {ghostPreviewPhoto
                ? <img src={prefs.ghostPhotoUrl!} alt="Ghost" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(20%)' }} />
                : CHARACTER_STYLES.find(c => c.id === prefs.ghostCharacterStyle)?.emoji}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text2)', opacity: 0.6 }}>{prefs.ghostCharacterName}</span>
          </div>
        </div>
      </div>

      {/* Save */}
      <div style={{ padding: '0 20px' }}>
        <button className="btn-primary" onClick={save}>
          {saved ? '✓ SAVED!' : 'SAVE FIGHTER'}
        </button>
      </div>
    </div>
  );
}
