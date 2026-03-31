'use client';

const ctx = typeof window !== 'undefined' 
  ? new (window.AudioContext || (window as any).webkitAudioContext)() 
  : null;

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'square',
  volume: number = 0.3
) {
  if (!ctx || ctx.state === 'suspended') return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export const arcadeSounds = {
  // Set completed — rising arpeggio
  setComplete: () => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.1, 'square', 0.2), i * 60);
    });
  },

  // Ghost beaten — triumphant fanfare
  ghostBeaten: () => {
    const fanfare = [523, 523, 523, 659, 523, 659, 784];
    fanfare.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.15, 'square', 0.25), i * 80);
    });
  },

  // Give up — descending sad tones
  giveUp: () => {
    const sad = [392, 349, 311, 294];
    sad.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.2, 'sawtooth', 0.15), i * 100);
    });
  },

  // Coin earned — classic coin sound
  coinEarned: () => {
    playTone(988, 0.1, 'square', 0.2);
    setTimeout(() => playTone(1319, 0.15, 'square', 0.2), 80);
  },

  // New personal record — special jingle
  newRecord: () => {
    const record = [784, 988, 1175, 1568];
    record.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.12, 'square', 0.2), i * 70);
    });
  },

  // Purchase success
  purchased: () => {
    const buy = [523, 659, 784, 1047, 1319];
    buy.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.1, 'sine', 0.25), i * 50);
    });
  }
};

// Resume AudioContext on first user interaction (required by browsers)
export function initAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
