import { useState, useRef, useEffect } from 'react';

export function useWorkoutTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const pausedElapsedRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  function tick() {
    if (!startTimeRef.current) return;
    const e = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setElapsed(e);
    rafRef.current = requestAnimationFrame(tick);
  }

  function start() {
    startTimeRef.current = Date.now() - pausedElapsedRef.current * 1000;
    setRunning(true);
    rafRef.current = requestAnimationFrame(tick);
  }

  function pause() {
    setRunning(false);
    pausedElapsedRef.current = elapsed;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }

  function stop(): number {
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    return elapsed;
  }

  function reset() {
    setRunning(false);
    setElapsed(0);
    pausedElapsedRef.current = 0;
    startTimeRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }

  // When screen locks and comes back — self-corrects automatically
  useEffect(() => {
    function onVisibilityChange() {
      if (!document.hidden && running && startTimeRef.current) {
        // Cancel old frame and restart tick — timer math is still correct
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function format(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  return { elapsed, running, start, pause, stop, reset, format };
}
