// Sound & Haptic manager for web
const PREF_KEY = 'ghostfit_settings';

interface Settings {
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

function getSettings(): Settings {
  if (typeof window === 'undefined') return { soundEnabled: true, hapticEnabled: true };
  try {
    const s = localStorage.getItem(PREF_KEY);
    return s ? JSON.parse(s) : { soundEnabled: true, hapticEnabled: true };
  } catch { return { soundEnabled: true, hapticEnabled: true }; }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(PREF_KEY, JSON.stringify(s));
}

export function getAppSettings(): Settings & { restDayStretch: boolean } {
  const s = getSettings();
  try {
    const raw = localStorage.getItem(PREF_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...s, restDayStretch: parsed.restDayStretch ?? true };
  } catch { return { ...s, restDayStretch: true }; }
}

// --- Sound (Web Audio API beeps) ---
let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine') {
  if (!getSettings().soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

export function playSetComplete() { playTone(800, 0.12, 'square'); }
export function playGhostBeaten() { playTone(523, 0.3); setTimeout(() => playTone(659, 0.3), 150); setTimeout(() => playTone(784, 0.5), 300); }
export function playGiveUp() { playTone(200, 0.4, 'sawtooth'); }
export function playMilestone() { playTone(784, 0.2); setTimeout(() => playTone(988, 0.2), 200); setTimeout(() => playTone(1175, 0.6), 400); }
export function playClick() { playTone(600, 0.05, 'sine'); }

// --- Haptics (Vibration API) ---
function vibrate(pattern: number | number[]) {
  if (!getSettings().hapticEnabled) return;
  try { navigator.vibrate?.(pattern); } catch {}
}

export function hapticSetComplete() { vibrate(50); }
export function hapticGhostBeaten() { vibrate([50, 80, 100]); }
export function hapticGiveUp() { vibrate(200); }
export function hapticMilestone() { vibrate([50, 50, 50, 50, 100]); }
