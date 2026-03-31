'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { COSMETICS, Cosmetic } from '@/data/cosmetics';
import { getProfile } from '@/lib/db';
import { arcadeSounds } from '@/utils/arcadeSounds';

export default function ShopScreen() {
  const router = useRouter();
  const [soulCoins, setSoulCoins] = useState(0);
  const [unlockedCosmetics, setUnlockedCosmetics] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [purchaseFlash, setPurchaseFlash] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const profile = await getProfile();
    if (profile) {
      setSoulCoins(profile.soulCoins || 0);
      setUnlockedCosmetics(profile.unlockedCosmetics || []);
    }
  }

  async function handlePurchase(item: Cosmetic) {
    if (soulCoins < item.cost) return;
    if (unlockedCosmetics.includes(item.id)) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    // Deduct coins
    await supabase.rpc('add_soul_coins', {
      user_id: session.user.id,
      amount: -item.cost
    });

    // Add to unlocked
    const newUnlocked = [...unlockedCosmetics, item.id];
    await supabase
      .from('profiles')
      .update({
        unlocked_cosmetics: newUnlocked
      })
      .eq('id', session.user.id);

    // Update local state and profile cache
    setSoulCoins(prev => prev - item.cost);
    setUnlockedCosmetics(newUnlocked);
    
    const cached = localStorage.getItem('ghostfit_profile');
    if (cached) {
      const parsed = JSON.parse(cached);
      parsed.soulCoins -= item.cost;
      parsed.unlockedCosmetics = newUnlocked;
      localStorage.setItem('ghostfit_profile', JSON.stringify(parsed));
    }

    // Show purchase celebration
    setPurchaseFlash(item.name);
    setTimeout(() => setPurchaseFlash(null), 2000);
    
    if (localStorage.getItem('ghostfit_sound_enabled') !== 'false') {
      arcadeSounds.purchased();
    }
  }

  const filteredCosmetics = COSMETICS.filter(c => activeFilter === 'all' || c.type === activeFilter);

  return (
    <div className="shop-container">
      {/* Header */}
      <div className="shop-header">
        <div className="shop-title-area">
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', padding: '8px 8px 8px 0', cursor: 'pointer' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div>
            <h1 className="shop-title">Soul Shop</h1>
            <p className="shop-subtitle">Spend your wins</p>
          </div>
        </div>
        
        {/* Coin balance */}
        <div className="shop-coin-badge">
          <span className="shop-coin-icon">⚡</span>
          <span className="shop-coin-amount">{soulCoins}</span>
          <span className="shop-coin-label">coins</span>
        </div>
      </div>

      {purchaseFlash && (
        <div className="shop-flash">
          Unlocked {purchaseFlash}! 🎉
        </div>
      )}

      {/* Filter tabs */}
      <div className="shop-filter-scroll">
        {['All', 'Aura', 'Headgear', 'Effect', 'Badge'].map(filter => (
          <button
            key={filter}
            onPointerDown={() => setActiveFilter(filter.toLowerCase())}
            className={`shop-filter-btn ${activeFilter === filter.toLowerCase() ? 'active' : ''}`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Cosmetics grid */}
      <div className="shop-grid">
        {filteredCosmetics.map(item => {
          const owned = unlockedCosmetics.includes(item.id);
          const canAfford = soulCoins >= item.cost;
          const rarityColor = item.rarity === 'legendary' ? 'rgba(255,215,0,0.4)' : item.rarity === 'rare' ? 'rgba(59,130,246,0.4)' : 'var(--border)';
          const rarityLabel = item.rarity === 'legendary' ? '#FFD700' : item.rarity === 'rare' ? '#60A5FA' : 'var(--text3)';

          return (
            <div key={item.id} className={`shop-card ${owned ? 'owned' : ''}`} style={{ borderColor: rarityColor }}>
              {/* Rarity label */}
              <p className="shop-rarity" style={{ color: rarityLabel }}>
                {item.rarity}
              </p>
              
              {/* Preview emoji */}
              <div className="shop-preview">{item.preview}</div>
              
              {/* Name + description */}
              <p className="shop-item-name">{item.name}</p>
              <p className="shop-item-desc">{item.description}</p>
              
              {/* Buy / Owned button */}
              <button
                onPointerDown={() => !owned && handlePurchase(item)}
                disabled={owned || !canAfford}
                className={`shop-buy-btn ${owned ? 'equipped' : canAfford ? 'available' : 'disabled'}`}
              >
                {owned ? '✓ Equipped' : `⚡ ${item.cost}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
