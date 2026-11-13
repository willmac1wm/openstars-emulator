import { GATE_RADIUS, NM_TO_PX } from '../constants';
import { bearingTo, distFromCenter } from './spawnTraffic';
import { GATES } from '../constants';
import type { Aircraft } from '../types';

/**
 * Test-only flight simulator, shared by the Expo and lesson crossing-time
 * tests. Flies an aircraft with App-like physics (3°/s sim turn rate,
 * constant speed) and returns wall-clock seconds until it hands off
 * (crosses back outside the gate ring after being inside it).
 *
 * The "player" holds the initial heading for `reactionWallSec`, then issues
 * the direct bearing to the fix once and never touches it again. Pass a
 * huge reactionWallSec to simulate an uncommanded aircraft (NORDO).
 */
export function simulateExitWallSec(
  ac: Aircraft,
  opts: { reactionWallSec?: number; timeScale?: number } = {},
): number {
  const timeScale = opts.timeScale ?? 6;
  const reactionSimSec = (opts.reactionWallSec ?? 5) * timeScale;
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const fix = GATES.find((g) => g.id === ac.destination)!.fix;
  const target = bearingTo({ x: ac.x, y: ac.y }, fix);
  let x = ac.x;
  let y = ac.y;
  let heading = ac.heading;
  let active = distFromCenter(x, y) <= GATE_RADIUS;
  const dt = 0.25; // sim seconds per step
  const maxSimSec = 1200;
  for (let t = 0; t < maxSimSec; t += dt) {
    const commanded = t >= reactionSimSec ? target : heading;
    let diff = commanded - heading;
    while (diff <= -180) diff += 360;
    while (diff > 180) diff -= 360;
    const turn = 3.0 * dt;
    if (Math.abs(diff) <= turn) heading = commanded;
    else heading += Math.sign(diff) * turn;
    heading = ((heading % 360) + 360) % 360;
    const move = ((ac.speed * NM_TO_PX) / 3600) * dt;
    x += Math.cos(toRad(heading)) * move;
    y += Math.sin(toRad(heading)) * move;
    const d = distFromCenter(x, y);
    if (!active && d <= GATE_RADIUS) active = true;
    if (active && d > GATE_RADIUS) return t / timeScale;
  }
  return Infinity;
}
