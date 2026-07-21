'use client';
import { useMemo } from 'react';

const COLORS = ['var(--accent)', '#FFD700', '#FF6B9D', '#60A5FA', '#FFFFFF', '#A78BFA'];

function particleValue(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Full-screen confetti burst. Mount it when the moment happens (win overlay,
 * quest complete) — particles fire once and fade; unmounts with its parent.
 * `big` = more particles, wider spread (PRs, quest completions).
 */
export default function Celebration({ big = false }: { big?: boolean }) {
  const parts = useMemo(() => {
    const count = big ? 70 : 44;
    return Array.from({ length: count }, (_, i) => {
      const angle = particleValue(i, 1) * Math.PI * 2;
      const dist = 90 + particleValue(i, 2) * (big ? 280 : 180);
      return {
        id: i,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist * 0.85 - 70, // bias upward, gravity pulls back down
        rot: (particleValue(i, 3) - 0.5) * 760,
        size: 5 + particleValue(i, 4) * 7,
        color: COLORS[i % COLORS.length],
        delay: particleValue(i, 5) * 0.25,
        dur: 1.1 + particleValue(i, 6) * 0.8,
        shape: i % 3,
      };
    });
  }, [big]);

  return (
    <div className="party" aria-hidden>
      {parts.map(p => (
        <span
          key={p.id}
          className={`party-p ${p.shape === 1 ? 'round' : ''}`}
          style={{
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
            ['--rot' as string]: `${p.rot}deg`,
            width: p.size,
            height: p.shape === 2 ? p.size * 2.4 : p.size,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}
