'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * A guided, hands-free player for warm-ups and cool-downs.
 *
 * "I don't know what to do after the workout" is a knowledge problem and a
 * timing problem. A checklist solves the first; this solves the second — it
 * counts each hold down, says which side you are on, and moves on by itself,
 * so a stretch actually gets the 35 seconds that makes it work.
 */
export interface PrepPlayStep {
  id: string;
  name: string;
  seconds: number;
  /** Rep-counted drills advance on tap instead of on a timer. */
  reps?: number | null;
  perSide: boolean;
  cue: string;
  /** Secondary line — why this one is here. */
  note?: string;
  tag: string;
}

interface Slice extends PrepPlayStep {
  sideLabel: string | null;
  key: string;
}

function expand(steps: PrepPlayStep[]): Slice[] {
  const out: Slice[] = [];
  steps.forEach(step => {
    if (step.perSide) {
      out.push({ ...step, sideLabel: 'Left side', key: `${step.id}-l` });
      out.push({ ...step, sideLabel: 'Right side', key: `${step.id}-r` });
    } else {
      out.push({ ...step, sideLabel: null, key: step.id });
    }
  });
  return out;
}

export default function PrepPlayer({
  title,
  accent,
  steps,
  onClose,
  onComplete,
}: {
  title: string;
  accent: string;
  steps: PrepPlayStep[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const slices = useMemo(() => expand(steps), [steps]);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(slices[0]?.seconds ?? 30);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = slices[index];
  const isRepStep = !!current?.reps;

  const advance = useCallback(() => {
    setIndex(i => {
      const next = i + 1;
      if (next >= slices.length) {
        setDone(true);
        return i;
      }
      setRemaining(slices[next].seconds);
      return next;
    });
  }, [slices]);

  useEffect(() => {
    if (done || paused || isRepStep) return;
    timerRef.current = setInterval(() => {
      setRemaining(value => {
        if (value <= 1) {
          advance();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [done, paused, isRepStep, index, advance]);

  // Escape closes, space toggles pause — the player is often driven one-handed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') { e.preventDefault(); setPaused(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!current) return null;

  const totalSeconds = slices.reduce((sum, s) => sum + s.seconds, 0);
  const elapsed = slices.slice(0, index).reduce((sum, s) => sum + s.seconds, 0)
    + (current.seconds - remaining);
  const progress = totalSeconds ? Math.min(100, (elapsed / totalSeconds) * 100) : 0;

  if (done) {
    return (
      <div className="prep-player">
        <div className="prep-player-done">
          <div className="prep-player-done-icon">✓</div>
          <h2>{title} complete</h2>
          <p>
            That is the part most people skip. Your joints, your next session and tomorrow morning
            will all notice you didn&apos;t.
          </p>
          <button className="btn-primary" onClick={onComplete}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="prep-player">
      <div className="prep-player-bar">
        <div className="prep-player-fill" style={{ width: `${progress}%`, background: accent }} />
      </div>

      <button className="prep-player-close" onClick={onClose} aria-label="Close">✕</button>

      <div className="prep-player-body">
        <span className="prep-player-tag" style={{ color: accent, borderColor: accent }}>
          {current.tag}
        </span>
        <p className="prep-player-count">Step {index + 1} of {slices.length}</p>

        <h2 className="prep-player-name">{current.name}</h2>
        {current.sideLabel && <p className="prep-player-side">{current.sideLabel}</p>}

        {isRepStep ? (
          <div className="prep-player-reps" style={{ color: accent }}>{current.reps} reps</div>
        ) : (
          <div className="prep-player-timer" style={{ color: accent }}>
            {String(Math.floor(remaining / 60)).padStart(1, '0')}:{String(remaining % 60).padStart(2, '0')}
          </div>
        )}

        <p className="prep-player-cue">{current.cue}</p>
        {current.note && <p className="prep-player-note">{current.note}</p>}

        <div className="prep-player-controls">
          <button
            className="prep-player-btn"
            onClick={() => {
              if (index === 0) return;
              setIndex(index - 1);
              setRemaining(slices[index - 1].seconds);
            }}
            disabled={index === 0}
          >
            ← Back
          </button>
          {!isRepStep && (
            <button className="prep-player-btn primary" onClick={() => setPaused(p => !p)}>
              {paused ? '▶ Resume' : '❚❚ Pause'}
            </button>
          )}
          <button className="prep-player-btn" onClick={advance}>
            {isRepStep ? 'Done →' : 'Skip →'}
          </button>
        </div>

        {slices[index + 1] && (
          <p className="prep-player-next">
            Next: {slices[index + 1].name}
            {slices[index + 1].sideLabel ? ` · ${slices[index + 1].sideLabel}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
