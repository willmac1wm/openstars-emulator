import { reduce } from './reducer';
import { emptySimState } from './scenarios/vectorToFinal';
import { FIXED_DT, type SimAction, type SimState } from './types';

export type Listener = (state: SimState) => void;

/**
 * Deterministic fixed-timestep sim store.
 * Wall-clock only decides how many FIXED_DT steps to run; state transitions
 * are pure via reduce(). Action log supports debrief replay / future netcode.
 */
export function createSimEngine(initial: SimState = emptySimState()) {
  let state = initial;
  const listeners = new Set<Listener>();
  let accumulator = 0;

  const getState = () => state;

  const dispatch = (action: SimAction) => {
    state = reduce(state, action);
    listeners.forEach((l) => l(state));
    return state;
  };

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  /** Advance by wall-clock seconds at current timeScale (fixed steps). */
  const advance = (wallDeltaSec: number) => {
    if (!state.running) return state;
    accumulator += wallDeltaSec;
    const stepWall = FIXED_DT; // one physics step per FIXED_DT wall when timeScale applied inside tick
    // We pass steps based on wall * timeScale conceptually inside TICK via FIXED_DT * timeScale in physics.
    // Here: accumulate wall time; each FIXED_DT wall emits one TICK step.
    let steps = 0;
    while (accumulator >= stepWall) {
      accumulator -= stepWall;
      steps += 1;
      if (steps > 100) {
        accumulator = 0;
        break;
      }
    }
    if (steps > 0) dispatch({ type: 'TICK', steps });
    return state;
  };

  return { getState, dispatch, subscribe, advance, FIXED_DT };
}

export type SimEngine = ReturnType<typeof createSimEngine>;
