'use client';
import { useState } from 'react';
import PrepPlayer, { type PrepPlayStep } from './PrepPlayer';
import type { CooldownStep, WarmupStep } from '@/lib/types';

const STAGE_LABELS: Record<WarmupStep['stage'], string> = {
  raise: 'Raise',
  mobilise: 'Mobilise',
  activate: 'Activate',
  potentiate: 'Ramp-up',
};

function minutesOf(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

function warmupToPlay(steps: WarmupStep[]): PrepPlayStep[] {
  return steps.map(s => ({
    id: s.id,
    name: s.name,
    seconds: s.durationSeconds,
    reps: s.reps,
    perSide: s.perSide,
    cue: s.cue,
    tag: STAGE_LABELS[s.stage],
  }));
}

function cooldownToPlay(steps: CooldownStep[]): PrepPlayStep[] {
  return steps.map(s => ({
    id: s.id,
    name: s.name,
    seconds: s.holdSeconds,
    reps: null,
    perSide: s.perSide,
    cue: s.cue,
    note: s.relief,
    tag: s.kind === 'breathing' ? 'Breathe' : 'Hold',
  }));
}

/**
 * The warm-up card that sits above the first exercise. Collapsed it is one
 * line; expanded it lists every drill; tapped it runs itself.
 */
export function WarmupCard({
  steps,
  done,
  onDone,
}: {
  steps: WarmupStep[];
  done: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  if (!steps?.length) return null;

  const total = minutesOf(steps.reduce((s, x) => s + x.durationSeconds * (x.perSide ? 2 : 1), 0));

  return (
    <>
      {playing && (
        <PrepPlayer
          title="Warm-up"
          accent="#FFB020"
          steps={warmupToPlay(steps)}
          onClose={() => setPlaying(false)}
          onComplete={() => { setPlaying(false); onDone(); }}
        />
      )}

      <div className={`sess-prep warm ${done ? 'complete' : ''}`}>
        <div className="sess-prep-head">
          <div className="sess-prep-icon">{done ? '✓' : '🔥'}</div>
          <div className="sess-prep-copy">
            <p className="sess-prep-title">{done ? 'Warm-up complete' : 'Warm-up first'}</p>
            <p className="sess-prep-sub">
              {done
                ? 'Joints prepped, nervous system online. Go lift.'
                : `${total} min · ${steps.length} drills · raise, mobilise, activate, ramp up`}
            </p>
          </div>
          {!done && (
            <button className="sess-prep-go" onClick={() => setPlaying(true)}>Start</button>
          )}
        </div>

        {!done && (
          <>
            <button className="sess-prep-toggle" onClick={() => setOpen(!open)}>
              {open ? 'Hide the drills' : 'See the drills'}
            </button>
            {open && (
              <div className="sess-prep-list">
                {steps.map(step => (
                  <div key={step.id} className="sess-prep-item">
                    <span className="sess-prep-stage">{STAGE_LABELS[step.stage]}</span>
                    <div>
                      <p className="sess-prep-name">
                        {step.name}
                        <span className="sess-prep-dose">
                          {step.reps ? ` · ${step.reps} reps` : ` · ${step.durationSeconds}s`}
                          {step.perSide ? ' each side' : ''}
                        </span>
                      </p>
                      <p className="sess-prep-cue">{step.cue}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="sess-prep-skip" onClick={onDone}>
              Already warm — skip
            </button>
          </>
        )}
      </div>
    </>
  );
}

/**
 * The cool-down. Deliberately loud once the last set is logged, because this
 * is the exact moment people walk out and then wonder why they hurt tomorrow.
 */
export function CooldownCard({
  steps,
  done,
  onDone,
  restDay = false,
}: {
  steps: CooldownStep[];
  done: boolean;
  onDone: () => void;
  restDay?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  if (!steps?.length) return null;

  const total = minutesOf(steps.reduce((s, x) => s + x.holdSeconds * (x.perSide ? 2 : 1), 0));
  const label = restDay ? 'Mobility flow' : 'Cool-down & stretch';

  return (
    <>
      {playing && (
        <PrepPlayer
          title={label}
          accent="#5AC8FA"
          steps={cooldownToPlay(steps)}
          onClose={() => setPlaying(false)}
          onComplete={() => { setPlaying(false); onDone(); }}
        />
      )}

      <div className={`sess-prep cool ${done ? 'complete' : ''}`}>
        <div className="sess-prep-head">
          <div className="sess-prep-icon">{done ? '✓' : '🧘'}</div>
          <div className="sess-prep-copy">
            <p className="sess-prep-title">{done ? `${label} done` : label}</p>
            <p className="sess-prep-sub">
              {done
                ? 'Recovery started. That is the part that compounds.'
                : `${total} min · ${steps.length} holds picked for the muscles you just trained`}
            </p>
          </div>
          {!done && (
            <button className="sess-prep-go cool" onClick={() => setPlaying(true)}>Start</button>
          )}
        </div>

        {!done && (
          <>
            <button className="sess-prep-toggle" onClick={() => setOpen(!open)}>
              {open ? 'Hide the stretches' : 'See the stretches'}
            </button>
            {open && (
              <div className="sess-prep-list">
                {steps.map(step => (
                  <div key={step.id} className="sess-prep-item">
                    <span className="sess-prep-stage cool">{step.kind === 'breathing' ? 'Breathe' : 'Hold'}</span>
                    <div>
                      <p className="sess-prep-name">
                        {step.name}
                        <span className="sess-prep-dose">
                          {` · ${step.holdSeconds}s`}{step.perSide ? ' each side' : ''}
                        </span>
                      </p>
                      <p className="sess-prep-cue">{step.cue}</p>
                      <p className="sess-prep-relief">{step.relief}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
