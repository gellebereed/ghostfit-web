// Mystery chest — variable post-workout reward.
// Unpredictable rewards resist habituation far better than flat payouts;
// winning tilts the odds so the chest never undercuts the battle itself.

export type ChestRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ChestDrop {
  rarity: ChestRarity;
  coins: number;
}

const RARITY_META: Record<ChestRarity, { label: string; emoji: string; color: string; min: number; max: number }> = {
  common:    { label: 'Common',    emoji: '🪙', color: '#A0A0A0', min: 8,   max: 15 },
  rare:      { label: 'Rare',      emoji: '💎', color: '#60A5FA', min: 20,  max: 40 },
  epic:      { label: 'Epic',      emoji: '🔮', color: '#8B5CF6', min: 50,  max: 90 },
  legendary: { label: 'Legendary', emoji: '👑', color: '#FFD700', min: 150, max: 250 },
};

// Cumulative odds per outcome
const ODDS: Record<'win' | 'loss', Array<[ChestRarity, number]>> = {
  win:  [['legendary', 0.03], ['epic', 0.15], ['rare', 0.45], ['common', 1]],
  loss: [['legendary', 0],    ['epic', 0.04], ['rare', 0.22], ['common', 1]],
};

export function rollChest(result: 'win' | 'loss'): ChestDrop {
  const roll = Math.random();
  let rarity: ChestRarity = 'common';
  for (const [r, threshold] of ODDS[result]) {
    if (roll < threshold) { rarity = r; break; }
  }
  const { min, max } = RARITY_META[rarity];
  const coins = min + Math.floor(Math.random() * (max - min + 1));
  return { rarity, coins };
}

export function chestMeta(rarity: ChestRarity) {
  return RARITY_META[rarity];
}
