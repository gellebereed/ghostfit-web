'use client';
import { useEffect, useId, useState } from 'react';

type RingProps = {
  /** 0–1. Values outside the range are clamped. */
  value: number;
  size?: number;
  stroke?: number;
  /** Big number in the middle. Omit for a bare ring. */
  label?: string;
  /** Small caption under the value. */
  caption?: string;
  /** Gradient start / end. Defaults to the live accent colour. */
  from?: string;
  to?: string;
  className?: string;
};

/**
 * The at-a-glance readout: a stroked arc that sweeps up from empty on mount.
 *
 * The sweep is deliberate — starting at zero and animating to the real value
 * is what makes the number feel earned rather than merely printed.
 */
export default function Ring({
  value,
  size = 96,
  stroke = 9,
  label,
  caption,
  from = 'var(--accent)',
  to = 'var(--accent-dim)',
  className = '',
}: RingProps) {
  const gradientId = useId();
  const [shown, setShown] = useState(0);

  const target = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Paint at zero first, then transition to the real value on the next frame
  // so the CSS transition on stroke-dashoffset actually has something to run.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <div className={`ring ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ring-bar"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown)}
        />
      </svg>

      {(label || caption) && (
        <div className="ring-center">
          {label && (
            <span className="ring-value" style={{ fontSize: Math.round(size * 0.27) }}>
              {label}
            </span>
          )}
          {caption && <span className="ring-label">{caption}</span>}
        </div>
      )}
    </div>
  );
}
