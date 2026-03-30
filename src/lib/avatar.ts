// Avatar preferences — stored in localStorage
export interface AvatarPrefs {
  yourCharacterStyle: string;
  yourAuraColor: string;
  yourCharacterName: string;
  ghostCharacterStyle: string;
  ghostAuraColor: string;
  ghostCharacterName: string;
  // Photo upload fields
  yourPhotoUrl: string | null;
  yourUsesPhoto: boolean;
  ghostPhotoUrl: string | null;
  ghostUsesPhoto: boolean;
}

const DEFAULTS: AvatarPrefs = {
  yourCharacterStyle: 'warrior',
  yourAuraColor: '#00FF87',
  yourCharacterName: 'YOU',
  ghostCharacterStyle: 'warrior',
  ghostAuraColor: '#FFFFFF',
  ghostCharacterName: 'GHOST',
  yourPhotoUrl: null,
  yourUsesPhoto: false,
  ghostPhotoUrl: null,
  ghostUsesPhoto: false,
};

const KEY = 'ghostfit_avatar';

export function getAvatarPrefs(): AvatarPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

export function saveAvatarPrefs(prefs: AvatarPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

export const CHARACTER_STYLES = [
  { id: 'warrior', emoji: '💪', name: 'Warrior' },
  { id: 'runner', emoji: '🏃', name: 'Runner' },
  { id: 'ninja', emoji: '🥷', name: 'Ninja' },
  { id: 'robot', emoji: '🤖', name: 'Robot' },
  { id: 'alien', emoji: '👾', name: 'Alien' },
  { id: 'beast', emoji: '🦁', name: 'Beast' },
];

export const YOUR_AURA_COLORS = [
  { color: '#00FF87', name: 'Green' },
  { color: '#FF6B35', name: 'Orange' },
  { color: '#7B2FFF', name: 'Purple' },
  { color: '#FF2D55', name: 'Red' },
  { color: '#00D4FF', name: 'Cyan' },
  { color: '#FFD700', name: 'Gold', minTier: 3 },
];

export const GHOST_AURA_COLORS = [
  { color: '#FFFFFF', name: 'Classic White' },
  { color: '#8B5CF6', name: 'Haunted Purple' },
  { color: '#60A5FA', name: 'Ice Blue' },
  { color: '#6B7280', name: 'Ash Gray' },
  { color: '#EF4444', name: 'Demon Red' },
  { color: '#1F1F1F', name: 'Void Black' },
];

export function getCharEmoji(style: string): string {
  return CHARACTER_STYLES.find(c => c.id === style)?.emoji || '💪';
}
