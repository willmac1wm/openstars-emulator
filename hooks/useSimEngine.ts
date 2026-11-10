import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createSimEngine, type SimEngine } from '../sim/engine';
import type { SimAction, SimState } from '../sim/types';
import { emptySimState } from '../sim/scenarios/vectorToFinal';

export function useSimEngine(active: boolean) {
  const engineRef = useRef<SimEngine | null>(null);
  if (!engineRef.current) engineRef.current = createSimEngine(emptySimState());
  const engine = engineRef.current;

  const state = useSyncExternalStore(
    (onStore) => engine.subscribe(onStore),
    () => engine.getState(),
    () => emptySimState(),
  );

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      engine.advance(dt);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active, engine]);

  const dispatch = useCallback((action: SimAction) => engine.dispatch(action), [engine]);

  return { state, dispatch, engine };
}

export function useSimSnapshot(state: SimState) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick((t) => t + 1);
  }, [state.simTime, state.score, state.aircraft]);
  return tick;
}
