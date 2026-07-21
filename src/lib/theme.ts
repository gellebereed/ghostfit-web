// UI system: base themes + aura-tinted accents + duotone focus heroes

export interface BaseTheme {
  id: string;
  name: string;
  tagline: string;
  swatch: [string, string]; // preview gradient
}

export const BASE_THEMES: BaseTheme[] = [
  { id: 'shadow',   name: 'Shadow',   tagline: 'Pure black. Classic GhostFit.', swatch: ['#0A0A0A', '#1C1C1C'] },
  { id: 'abyss',    name: 'Abyss',    tagline: 'Deep ocean blues. Calm focus.', swatch: ['#070B14', '#16203A'] },
  { id: 'royale',   name: 'Royale',   tagline: 'Midnight purple. Main character.', swatch: ['#0B0714', '#1E1433'] },
  { id: 'ember',    name: 'Ember',    tagline: 'Forged in fire. All heat.', swatch: ['#120806', '#2A1712'] },
  { id: 'jade',     name: 'Jade',     tagline: 'Deep forest. Steady growth.', swatch: ['#06110C', '#12271D'] },
  { id: 'daylight', name: 'Daylight', tagline: 'Bright mode. Train in the sun.', swatch: ['#F4F5F7', '#DDE1E7'] },
];

const THEME_KEY = 'ghostfit_theme';

export function getSavedTheme(): string {
  if (typeof window === 'undefined') return 'shadow';
  return localStorage.getItem(THEME_KEY) ?? 'shadow';
}

export function applyBaseTheme(themeId: string) {
  if (typeof document === 'undefined') return;
  const valid = BASE_THEMES.some(t => t.id === themeId) ? themeId : 'shadow';
  document.documentElement.dataset.theme = valid;
  localStorage.setItem(THEME_KEY, valid);
}

/** Tint the whole UI to the user's chosen aura color. */
export function applyAuraTheme(color?: string | null) {
  if (typeof document === 'undefined') return;
  const hex = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#00FF87';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dim = `#${[r, g, b].map(v => Math.round(v * 0.8).toString(16).padStart(2, '0')).join('')}`;

  const root = document.documentElement.style;
  root.setProperty('--accent', hex);
  root.setProperty('--accent-dim', dim);
  root.setProperty('--accent-glow', `rgba(${r},${g},${b},0.15)`);
  root.setProperty('--accent-glow2', `rgba(${r},${g},${b},0.3)`);
}

/** Consistent duotone hero art per workout focus — replaces stock photos. */
export const FOCUS_THEMES: Record<string, { emoji: string; from: string; to: string }> = {
  'Upper Body': { emoji: '💪', from: '#0E3A5C', to: '#071624' },
  'Lower Body': { emoji: '🦵', from: '#3A1D5C', to: '#150724' },
  'Push':       { emoji: '🔥', from: '#5C2A0E', to: '#241007' },
  'Pull':       { emoji: '🧲', from: '#0E2A5C', to: '#071024' },
  'Legs':       { emoji: '🦵', from: '#3A1D5C', to: '#150724' },
  'Core':       { emoji: '🛡️', from: '#5C4A0E', to: '#241D07' },
  'Cardio':     { emoji: '⚡', from: '#5C0E1E', to: '#24070C' },
  'Full Body':  { emoji: '👊', from: '#0E5C38', to: '#072416' },
  'Rest':       { emoji: '😴', from: '#1C1C24', to: '#0A0A0E' },
};

export function getFocusTheme(focus: string) {
  return FOCUS_THEMES[focus] ?? FOCUS_THEMES['Full Body'];
}
