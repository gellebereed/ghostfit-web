export interface Cosmetic {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: 'aura' | 'badge' | 'effect' | 'headgear';
  preview: string;
  rarity: 'common' | 'rare' | 'legendary';
}

export const COSMETICS: Cosmetic[] = [
  // AURAS
  { id: 'aura_fire', name: 'Fire Aura', description: 'Burn like you never quit', cost: 50, type: 'aura', preview: '🔥', rarity: 'common' },
  { id: 'aura_ice', name: 'Ice Aura', description: 'Cold. Calculated. Consistent.', cost: 50, type: 'aura', preview: '🧊', rarity: 'common' },
  { id: 'aura_lightning', name: 'Lightning Aura', description: 'Faster than yesterday', cost: 100, type: 'aura', preview: '⚡', rarity: 'rare' },
  { id: 'aura_gold', name: 'Gold Aura', description: 'Elite. Period.', cost: 200, type: 'aura', preview: '✨', rarity: 'legendary' },
  
  // HEADGEAR
  { id: 'head_crown', name: 'Champion Crown', description: 'For those who beat their ghost 10+ times', cost: 150, type: 'headgear', preview: '👑', rarity: 'rare' },
  { id: 'head_ninja', name: 'Ninja Band', description: 'Silent. Deadly. Consistent.', cost: 75, type: 'headgear', preview: '🥷', rarity: 'common' },
  { id: 'head_horns', name: 'Beast Horns', description: 'For the animals who never skip', cost: 100, type: 'headgear', preview: '😈', rarity: 'rare' },
  
  // EFFECTS
  { id: 'effect_glitch', name: 'Glitch Effect', description: 'Your fighter corrupts reality', cost: 175, type: 'effect', preview: '📺', rarity: 'legendary' },
  { id: 'effect_rainbow', name: 'Rainbow Trail', description: 'Leave your mark', cost: 125, type: 'effect', preview: '🌈', rarity: 'rare' },
  
  // BADGES
  { id: 'badge_streak', name: 'Streak Demon', description: 'Proof you showed up', cost: 80, type: 'badge', preview: '🔥', rarity: 'common' },
  { id: 'badge_skull', name: 'Ghost Slayer', description: 'You haunt your past self', cost: 120, type: 'badge', preview: '💀', rarity: 'rare' }
];
