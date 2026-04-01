import { useState, useRef, useEffect } from 'react';
import { useWorkoutTimer } from '../utils/workoutTimer';
import { RestTimer } from './RestTimer';
import { Exercise } from '../lib/types';

interface SetData {
  weight?: number;
  reps?: number;
  duration?: number;
}

interface SmartLoggerProps {
  exercise: Exercise;  // full exercise object from plan — has metricType
  currentSet: number;
  onSetComplete: (data: SetData) => void;
  ghostDuration?: number;  // seconds — for cardio ghost comparison
  isResting: boolean;
  restSeconds: number;
  onSkipRest: () => void;
}

export function SmartLogger({
  exercise, currentSet, onSetComplete,
  ghostDuration = 0, isResting, restSeconds, onSkipRest
}: SmartLoggerProps) {

  // Read metricType directly from plan — AI already decided this
  const metricType = exercise.metricType ?? 'weight_reps';

  return (
    <div className="sl-card">
      {/* Metric mode label */}
      <div className="sl-label-group">
        <p className="sl-label-main">
          {metricType !== 'cardio' ? `SET ${currentSet} OF ${exercise.sets}` : 'CARDIO SESSION'}
        </p>
        <span className="text-gray-700 text-[10px]">·</span>
        <span className="sl-label-sub">
          {metricType === 'weight_reps'      && 'Weight + Reps'}
          {metricType === 'bodyweight_reps'  && 'Bodyweight'}
          {metricType === 'duration'         && `Hold ${exercise.durationSeconds ?? 30}s`}
          {metricType === 'cardio'           && 'Running Timer'}
          {metricType === 'reps_only'        && 'Reps'}
        </span>
      </div>

      {metricType === 'weight_reps' && (
        <WeightRepsLogger
          onComplete={onSetComplete}
          isResting={isResting}
          restSeconds={restSeconds}
          onSkipRest={onSkipRest}
          currentSet={currentSet}
          totalSets={exercise.sets}
        />
      )}

      {metricType === 'bodyweight_reps' && (
        <BodyweightRepsLogger
          onComplete={onSetComplete}
          isResting={isResting}
          restSeconds={restSeconds}
          onSkipRest={onSkipRest}
          currentSet={currentSet}
          totalSets={exercise.sets}
        />
      )}

      {metricType === 'reps_only' && (
        <RepsOnlyLogger
          onComplete={onSetComplete}
          isResting={isResting}
          restSeconds={restSeconds}
          onSkipRest={onSkipRest}
          currentSet={currentSet}
          totalSets={exercise.sets}
        />
      )}

      {metricType === 'duration' && (
        <DurationLogger
          targetSeconds={exercise.durationSeconds ?? 30}
          onComplete={onSetComplete}
          isResting={isResting}
          restSeconds={restSeconds}
          onSkipRest={onSkipRest}
          currentSet={currentSet}
          totalSets={exercise.sets}
        />
      )}

      {metricType === 'cardio' && (
        <CardioLogger
          targetSeconds={exercise.durationSeconds ?? 1200}
          ghostDuration={ghostDuration}
          onComplete={onSetComplete}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPLETE SET BUTTON — shared by strength loggers
// ─────────────────────────────────────────────────────────────

function CompleteSetButton({ onComplete }: { onComplete: () => void }) {
  const processingRef = useRef(false);

  function handleTap() {
    if (processingRef.current) return;
    processingRef.current = true;
    onComplete();
    setTimeout(() => { processingRef.current = false; }, 600);
  }

  return (
    <button
      onPointerDown={handleTap}
      style={{ touchAction: 'manipulation' }}
      className="sl-btn-complete"
    >
      COMPLETE SET ✓
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGGER 1 — WEIGHT + REPS
// ─────────────────────────────────────────────────────────────

function WeightRepsLogger({ onComplete, isResting, restSeconds,
  onSkipRest, currentSet, totalSets }: any) {
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);

  if (isResting) return (
    <RestTimer seconds={restSeconds} onSkip={onSkipRest}
               nextSet={currentSet + 1} totalSets={totalSets} />
  );

  return (
    <div>
      <div className="sl-input-group">
        {/* Weight */}
        <div className="sl-input-card">
          <p className="sl-input-hdr">Weight</p>
          <div className="sl-input-wrap">
            <input type="number" inputMode="decimal"
              value={weight || ''} placeholder="0"
              onChange={e => setWeight(Number(e.target.value))}
              className="sl-input-main"
            />
            <span className="sl-input-unit">kg</span>
          </div>
          <div className="sl-adjust-btns">
            {[-5, -1, +1, +5].map(d => (
              <button key={d}
                onPointerDown={() => setWeight(w => Math.max(0, w + d))}
                style={{ touchAction: 'manipulation' }}
                className="sl-adjust-btn">
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
          </div>
        </div>

        {/* Reps */}
        <div className="sl-input-card">
          <p className="sl-input-hdr">Reps</p>
          <div className="sl-input-wrap">
            <input type="number" inputMode="numeric"
              value={reps || ''} placeholder="0"
              onChange={e => setReps(Number(e.target.value))}
              className="sl-input-main"
            />
            <span className="sl-input-unit">reps</span>
          </div>
          <div className="sl-adjust-btns">
            {[-3, -1, +1, +3].map(d => (
              <button key={d}
                onPointerDown={() => setReps(r => Math.max(0, r + d))}
                style={{ touchAction: 'manipulation' }}
                className="sl-adjust-btn">
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
          </div>
        </div>
      </div>
      <CompleteSetButton onComplete={() => onComplete({ weight, reps })} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGGER 2 — BODYWEIGHT REPS
// ─────────────────────────────────────────────────────────────

function BodyweightRepsLogger({ onComplete, isResting, restSeconds,
  onSkipRest, currentSet, totalSets }: any) {
  const [reps, setReps] = useState(0);

  if (isResting) return (
    <RestTimer seconds={restSeconds} onSkip={onSkipRest}
               nextSet={currentSet + 1} totalSets={totalSets} />
  );

  return (
    <div>
      <div className="sl-input-card full mb-4">
        <p className="sl-input-hdr">Reps</p>
        <div className="sl-input-wrap">
          <input type="number" inputMode="numeric"
            value={reps || ''} placeholder="0"
            onChange={e => setReps(Number(e.target.value))}
            className="sl-input-main"
            style={{ fontSize: 64 }}
          />
          <span className="sl-input-unit">reps</span>
        </div>
        <div className="sl-adjust-btns">
          {[-5, -1, +1, +5].map(d => (
            <button key={d}
              onPointerDown={() => setReps(r => Math.max(0, r + d))}
              style={{ touchAction: 'manipulation' }}
              className="sl-adjust-btn">
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
        </div>
      </div>
      <CompleteSetButton onComplete={() => onComplete({ reps })} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGGER 3 — REPS ONLY (burpees, box jumps etc)
// ─────────────────────────────────────────────────────────────

function RepsOnlyLogger({ onComplete, isResting, restSeconds,
  onSkipRest, currentSet, totalSets }: any) {
  const [reps, setReps] = useState(0);

  if (isResting) return (
    <RestTimer seconds={restSeconds} onSkip={onSkipRest}
               nextSet={currentSet + 1} totalSets={totalSets} />
  );

  return (
    <div>
      <div className="sl-input-card full mb-4">
        <p className="sl-input-hdr">Reps</p>
        <div className="sl-input-wrap">
          <input type="number" inputMode="numeric"
            value={reps || ''} placeholder="0"
            onChange={e => setReps(Number(e.target.value))}
            className="sl-input-main"
            style={{ fontSize: 64 }}
          />
          <span className="sl-input-unit">reps</span>
        </div>
        <div className="sl-adjust-btns">
          {[-5, -1, +1, +5].map(d => (
            <button key={d}
              onPointerDown={() => setReps(r => Math.max(0, r + d))}
              style={{ touchAction: 'manipulation' }}
              className="sl-adjust-btn">
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
        </div>
      </div>
      <CompleteSetButton onComplete={() => onComplete({ reps })} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGGER 4 — DURATION (plank, wall sit, dead hang)
// ─────────────────────────────────────────────────────────────

function DurationLogger({ targetSeconds, onComplete, isResting,
  restSeconds, onSkipRest, currentSet, totalSets }: any) {

  const { elapsed, running, start, pause, stop, reset }
    = useWorkoutTimer();

  const progress = Math.min(elapsed / targetSeconds, 1);
  const isComplete = elapsed >= targetSeconds;
  const circumference = 2 * Math.PI * 60;

  if (isResting) return (
    <RestTimer seconds={restSeconds} onSkip={onSkipRest}
               nextSet={currentSet + 1} totalSets={totalSets} />
  );

  return (
    <div className="rt-container">
      <p className="sl-input-hdr mb-5">
        Target hold: <span style={{ color: '#FFF' }}>{targetSeconds}s</span>
      </p>

      {/* Circular progress timer */}
      <div className="rt-circle-wrap">
        <svg viewBox="0 0 144 144" className="rt-svg">
          <circle cx="72" cy="72" r="60" className="rt-circle-bg" />
          <circle cx="72" cy="72" r="60"
                  className="rt-circle-progress"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>
        <div className="rt-content">
          <span className="rt-val">{elapsed}</span>
          <span className="rt-lbl">seconds</span>
        </div>
      </div>

      {isComplete && (
        <p className="sl-status green animate-pulse">✓ Target reached!</p>
      )}

      <div className="sl-controls">
        {!running ? (
          <button onPointerDown={start}
            style={{ touchAction: 'manipulation' }}
            className="sl-btn-main sl-btn-start">
            {elapsed === 0 ? '▶ Start Hold' : '▶ Resume'}
          </button>
        ) : (
          <button onPointerDown={pause}
            style={{ touchAction: 'manipulation' }}
            className="sl-btn-main sl-btn-pause">
            ⏸ Pause
          </button>
        )}

        {elapsed > 0 && (
          <button onPointerDown={() => onComplete({ duration: stop() })}
            style={{ touchAction: 'manipulation' }}
            className="sl-btn-secondary">
            ✓ Done
          </button>
        )}
      </div>

      {elapsed > 0 && !running && (
        <button onPointerDown={reset}
          style={{ touchAction: 'manipulation' }}
          className="mt-3 text-gray-600 text-xs underline underline-offset-2 bg-transparent border-none cursor-pointer">
          Reset
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGGER 5 — CARDIO (treadmill, rowing, cycling)
// Uses screen-lock-safe timer from useWorkoutTimer
// ─────────────────────────────────────────────────────────────

function CardioLogger({ targetSeconds, ghostDuration, onComplete }: any) {

  const { elapsed, running, start, pause, stop, format }
    = useWorkoutTimer();

  const beatGhost = ghostDuration > 0 && elapsed >= ghostDuration;
  const targetReached = elapsed >= targetSeconds;

  return (
    <div className="rt-container">
      {/* Ghost target info */}
      {ghostDuration > 0 && (
        <div className="sl-ghost-pill">
          Ghost time: <span className="sl-ghost-val">{format(ghostDuration)}</span>
        </div>
      )}

      {/* Big timer display */}
      <div className="sl-cardio-timer tabular-nums">
        {format(elapsed)}
      </div>

      {/* Status messages */}
      <div className="sl-status">
        {beatGhost && (
          <p className="green animate-pulse">
            👻 Ghost beaten! +{format(elapsed - ghostDuration)} ahead
          </p>
        )}
        {!beatGhost && ghostDuration > 0 && elapsed > 0 && (
          <p className="sl-status gray">
            {format(ghostDuration - elapsed)} to beat ghost
          </p>
        )}
        {targetReached && (
          <p className="green">
            ✓ Target reached — keep going or finish!
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="sl-controls">
        {!running ? (
          <button onPointerDown={start}
            style={{ touchAction: 'manipulation' }}
            className="sl-btn-main sl-btn-start">
            {elapsed === 0 ? '▶ Start' : '▶ Resume'}
          </button>
        ) : (
          <button onPointerDown={pause}
            style={{ touchAction: 'manipulation' }}
            className="sl-btn-main sl-btn-pause">
            ⏸ Pause
          </button>
        )}

        {elapsed > 0 && (
          <button onPointerDown={() => onComplete({ duration: stop() })}
            style={{ touchAction: 'manipulation' }}
            className="sl-btn-secondary">
            ✓ Finish
          </button>
        )}
      </div>

      {/* Target duration hint */}
      {targetSeconds > 0 && (
        <p className="sl-label-sub mt-4">
          Suggested: {format(targetSeconds)}
        </p>
      )}
    </div>
  );
}
