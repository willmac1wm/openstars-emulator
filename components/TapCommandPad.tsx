import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Aircraft } from '../types';
import { ALTS_NORTH_EAST, ALTS_SOUTH_WEST } from '../constants';
import { prewarmReadback } from '../services/pilotVoice';
import {
  composeTapClearance,
  DIAL_NUDGE_DEG,
  normalizeHeadingDeg,
  nudgeHeading,
  snapHeading5,
} from '../services/tapClearance';
import { createTapIssueGate } from '../services/tapIssueGate';

interface TapCommandPadProps {
  aircraft: Aircraft | null;
  onIssue: (command: string) => void;
}

/** Larger dial; stacked H/A/S sections still fit 1024×640 with typed line + Issue. */
const DIAL_SIZE = 128;
const DIAL_R = DIAL_SIZE / 2 - 6;

function angleFromPointer(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  // Ignore near-center presses — atan2 is unstable and can snap to a bogus north.
  const dx = clientX - cx;
  const dy = cy - clientY;
  if (dx * dx + dy * dy < 64) return -1;
  const rad = Math.atan2(dx, dy);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return snapHeading5(deg);
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable;
}

const TapCommandPad: React.FC<TapCommandPadProps> = ({ aircraft, onIssue }) => {
  const [heading, setHeading] = useState<number | null>(null);
  const [turnForced, setTurnForced] = useState<'LEFT' | 'RIGHT' | null>(null);
  const [altitude, setAltitude] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const dialRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);
  const onIssueRef = useRef(onIssue);
  onIssueRef.current = onIssue;
  // Stable gate — do not recreate on parent render (would drop the debounce lock).
  const gateRef = useRef(createTapIssueGate((cmd) => onIssueRef.current(cmd)));

  // Always show every gate altitude (N/E odd + S/W even) so trainees can pick any legal exit alt.
  const legalAlts = useMemo(
    () => [...new Set([...ALTS_SOUTH_WEST, ...ALTS_NORTH_EAST])].sort((a, b) => a - b),
    [],
  );

  // Reset pad when the selected aircraft changes — never carry a stale heading.
  useEffect(() => {
    setHeading(null);
    setTurnForced(null);
    setAltitude(null);
    setSpeed(null);
    gateRef.current.reset();
  }, [aircraft?.id]);

  const preview = useMemo(() => {
    if (!aircraft) {
      return { command: '', phraseology: 'Select an aircraft', hasElements: false, effectiveTurn: null };
    }
    return composeTapClearance({
      callsign: aircraft.callsign,
      currentHeading: aircraft.heading,
      currentAltitudeHundreds: aircraft.altitude,
      currentSpeed: aircraft.speed,
      heading,
      turnForced,
      altitudeHundreds: altitude,
      speed,
    });
  }, [aircraft, heading, turnForced, altitude, speed]);

  useEffect(() => {
    if (!aircraft || !preview.hasElements) return;
    const timer = window.setTimeout(() => {
      prewarmReadback(preview.phraseology, aircraft.callsign);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [aircraft, preview.phraseology, preview.hasElements]);

  const issue = useCallback(() => {
    if (!preview.hasElements || !preview.command) return;
    // Dial / chips only stage values — Issue/Enter alone send, once.
    if (!gateRef.current.tryIssue(preview.command)) return;
    setHeading(null);
    setTurnForced(null);
    setAltitude(null);
    setSpeed(null);
  }, [preview.command, preview.hasElements]);

  // Enter issues the built clearance once (never when typing in the command line).
  useEffect(() => {
    if (!aircraft) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (isTypingTarget(e.target)) return;
      if (!preview.hasElements) return;
      // Prefer the focused Issue button's own click — skip duplicate window handler.
      if (e.target instanceof HTMLElement && e.target.dataset.testid === 'tap-issue') return;
      e.preventDefault();
      issue();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aircraft, issue, preview.hasElements]);

  const applyDialPoint = useCallback((clientX: number, clientY: number) => {
    const el = dialRef.current;
    if (!el) return;
    const next = angleFromPointer(clientX, clientY, el.getBoundingClientRect());
    if (next < 0) return; // center dead-zone — do not set a default heading
    setHeading(next);
    // Changing the dial clears any forced turn → back to shortest.
    setTurnForced(null);
  }, []);

  const onDialPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    applyDialPoint(e.clientX, e.clientY);
    // Dial never issues — staging only.
  };

  const onDialPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    applyDialPoint(e.clientX, e.clientY);
  };

  const onDialPointerUp = () => {
    dragging.current = false;
  };

  const toggleAltitude = (alt: number) => {
    setAltitude((prev) => (prev === alt ? null : alt));
  };

  const toggleSpeed = (spd: number) => {
    setSpeed((prev) => (prev === spd ? null : spd));
  };

  if (!aircraft) {
    return (
      <div className="border border-gray-700 rounded p-2 text-xs text-gray-500 text-center shrink-0">
        Tap a plane on the scope, then build a clearance.
      </div>
    );
  }

  const currentHdg = normalizeHeadingDeg(aircraft.heading);
  const targetHdg = heading;
  const autoTurn = preview.effectiveTurn;
  const needleDeg = targetHdg ?? currentHdg;

  /**
   * LEFT/RIGHT nudge the staged heading by DIAL_NUDGE_DEG — exactly like
   * dragging the dial — starting from the live heading when nothing is
   * staged yet, so the button always arms ISSUE. (They used to only set a
   * forced turn direction, which staged nothing on its own.)
   */
  const nudge = (direction: 'LEFT' | 'RIGHT') => {
    const next = nudgeHeading(currentHdg, heading, direction);
    setHeading(next.heading);
    setTurnForced(next.turnForced);
  };

  return (
    <div
      className="border border-amber-700/50 bg-amber-950/20 rounded flex flex-col min-h-0 flex-1"
      data-testid="tap-command-pad"
    >
      <div className="flex-1 min-h-0 overflow-y-auto px-1.5 pt-1 pb-0.5 space-y-1" data-testid="tap-build-area">
        <div className="text-[8px] uppercase tracking-wider text-amber-300 leading-none">
          Tap clearance · shortest turn · Issue once
        </div>

        {/* HEADING — cyan */}
        <section
          className="rounded border border-cyan-600/70 bg-cyan-950/25 p-1 space-y-1"
          data-testid="tap-heading-section"
          aria-label="Heading"
        >
          <div className="text-[9px] font-bold uppercase tracking-wider text-cyan-300 px-0.5">Heading</div>
          <div className="flex items-center gap-2">
            <div className="shrink-0 relative mx-auto" style={{ width: DIAL_SIZE, height: DIAL_SIZE }}>
              <svg
                ref={dialRef}
                width={DIAL_SIZE}
                height={DIAL_SIZE}
                viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
                className="touch-none select-none cursor-crosshair"
                data-testid="heading-dial"
                onPointerDown={onDialPointerDown}
                onPointerMove={onDialPointerMove}
                onPointerUp={onDialPointerUp}
                onPointerCancel={onDialPointerUp}
                role="slider"
                aria-label="Heading dial"
                aria-valuemin={5}
                aria-valuemax={360}
                aria-valuenow={targetHdg ?? currentHdg}
                aria-valuetext={
                  targetHdg != null
                    ? `Heading ${String(targetHdg).padStart(3, '0')}`
                    : `Current ${String(currentHdg).padStart(3, '0')} — drag to set`
                }
              >
                <circle
                  cx={DIAL_SIZE / 2}
                  cy={DIAL_SIZE / 2}
                  r={DIAL_R}
                  fill="#0a0f0a"
                  stroke="#0e7490"
                  strokeWidth={2}
                />
                {[0, 90, 180, 270].map((deg) => {
                  const rad = ((deg - 90) * Math.PI) / 180;
                  const x1 = DIAL_SIZE / 2 + Math.cos(rad) * (DIAL_R - 8);
                  const y1 = DIAL_SIZE / 2 + Math.sin(rad) * (DIAL_R - 8);
                  const x2 = DIAL_SIZE / 2 + Math.cos(rad) * DIAL_R;
                  const y2 = DIAL_SIZE / 2 + Math.sin(rad) * DIAL_R;
                  return (
                    <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#22d3ee" strokeWidth={2} />
                  );
                })}
                {Array.from({ length: 12 }, (_, i) => i * 30).map((deg) => {
                  if (deg % 90 === 0) return null;
                  const rad = ((deg - 90) * Math.PI) / 180;
                  const x1 = DIAL_SIZE / 2 + Math.cos(rad) * (DIAL_R - 5);
                  const y1 = DIAL_SIZE / 2 + Math.sin(rad) * (DIAL_R - 5);
                  const x2 = DIAL_SIZE / 2 + Math.cos(rad) * DIAL_R;
                  const y2 = DIAL_SIZE / 2 + Math.sin(rad) * DIAL_R;
                  return (
                    <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#155e75" strokeWidth={1} />
                  );
                })}
                <text x={DIAL_SIZE / 2} y={14} textAnchor="middle" fill="#67e8f9" fontSize={9} fontFamily="monospace">
                  N
                </text>
                <g transform={`rotate(${currentHdg} ${DIAL_SIZE / 2} ${DIAL_SIZE / 2})`}>
                  <line
                    x1={DIAL_SIZE / 2}
                    y1={DIAL_SIZE / 2 - DIAL_R + 10}
                    x2={DIAL_SIZE / 2}
                    y2={DIAL_SIZE / 2 - DIAL_R + 1}
                    stroke="#22d3ee"
                    strokeWidth={2.5}
                    data-testid="current-hdg-tick"
                  />
                </g>
                <g transform={`rotate(${needleDeg} ${DIAL_SIZE / 2} ${DIAL_SIZE / 2})`}>
                  <polygon
                    points={`${DIAL_SIZE / 2},${DIAL_SIZE / 2 - DIAL_R + 12} ${DIAL_SIZE / 2 - 5},${DIAL_SIZE / 2 + 4} ${DIAL_SIZE / 2 + 5},${DIAL_SIZE / 2 + 4}`}
                    fill={targetHdg != null ? '#67e8f9' : '#4b5563'}
                    data-testid="heading-needle"
                  />
                </g>
                <circle cx={DIAL_SIZE / 2} cy={DIAL_SIZE / 2} r={3} fill="#e5e7eb" />
              </svg>
              <div
                className="absolute inset-x-0 bottom-0.5 text-center font-mono text-[11px] text-cyan-100 pointer-events-none"
                data-testid="heading-readout"
              >
                {targetHdg != null
                  ? `H${String(targetHdg).padStart(3, '0')}`
                  : `— ${String(currentHdg).padStart(3, '0')} —`}
              </div>
            </div>

            <div className="flex flex-col gap-1 min-w-[4.5rem]">
              <button
                type="button"
                data-testid="turn-left"
                aria-label={`Nudge heading left ${DIAL_NUDGE_DEG} degrees`}
                title={`Nudge heading left ${DIAL_NUDGE_DEG}°`}
                className={`py-1.5 rounded border text-[11px] font-bold ${
                  turnForced === 'LEFT'
                    ? 'bg-cyan-700 border-cyan-400 text-white'
                    : autoTurn === 'LEFT' && targetHdg != null && turnForced == null
                      ? 'border-cyan-600/70 text-cyan-300'
                      : 'border-gray-700 text-gray-400'
                }`}
                onClick={() => nudge('LEFT')}
              >
                LEFT −{DIAL_NUDGE_DEG}°
              </button>
              <button
                type="button"
                data-testid="turn-right"
                aria-label={`Nudge heading right ${DIAL_NUDGE_DEG} degrees`}
                title={`Nudge heading right ${DIAL_NUDGE_DEG}°`}
                className={`py-1.5 rounded border text-[11px] font-bold ${
                  turnForced === 'RIGHT'
                    ? 'bg-cyan-700 border-cyan-400 text-white'
                    : autoTurn === 'RIGHT' && targetHdg != null && turnForced == null
                      ? 'border-cyan-600/70 text-cyan-300'
                      : 'border-gray-700 text-gray-400'
                }`}
                onClick={() => nudge('RIGHT')}
              >
                RIGHT +{DIAL_NUDGE_DEG}°
              </button>
              <div className="text-[8px] text-cyan-200/70 leading-tight" data-testid="turn-hint">
                {targetHdg == null
                  ? 'Dial or nudge — then Issue'
                  : turnForced
                    ? `Forced ${turnForced.toLowerCase()} · H${String(targetHdg).padStart(3, '0')}`
                    : autoTurn
                      ? `Shortest: ${autoTurn.toLowerCase()}`
                      : 'On heading'}
              </div>
            </div>
          </div>
        </section>

        {/* ALTITUDE — amber */}
        <section
          className="rounded border border-amber-600/70 bg-amber-950/30 p-1 space-y-1"
          data-testid="tap-altitude-section"
          aria-label="Altitude"
        >
          <div className="text-[9px] font-bold uppercase tracking-wider text-amber-300 px-0.5">Altitude</div>
          <div className="flex flex-wrap gap-1">
            {legalAlts.map((alt) => (
              <button
                key={alt}
                type="button"
                data-testid={`alt-${alt}`}
                onClick={() => toggleAltitude(alt)}
                className={`min-w-[3.25rem] px-2 py-1.5 rounded border text-xs font-mono font-bold ${
                  altitude === alt
                    ? 'bg-amber-600 border-amber-300 text-black'
                    : 'border-amber-800/80 text-amber-100/80'
                }`}
              >
                A{String(alt).padStart(3, '0')}
              </button>
            ))}
          </div>
        </section>

        {/* SPEED — magenta */}
        <section
          className="rounded border border-fuchsia-600/70 bg-fuchsia-950/25 p-1 space-y-1"
          data-testid="tap-speed-section"
          aria-label="Speed"
        >
          <div className="text-[9px] font-bold uppercase tracking-wider text-fuchsia-300 px-0.5">Speed</div>
          <div className="flex flex-wrap gap-1">
            {[180, 210, 250].map((spd) => (
              <button
                key={spd}
                type="button"
                data-testid={`spd-${spd}`}
                onClick={() => toggleSpeed(spd)}
                className={`min-w-[3.25rem] px-2 py-1.5 rounded border text-xs font-mono font-bold ${
                  speed === spd
                    ? 'bg-fuchsia-600 border-fuchsia-300 text-black'
                    : 'border-fuchsia-800/80 text-fuchsia-100/80'
                }`}
              >
                S{spd}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Sticky preview + ISSUE — always visible; only path that sends a command */}
      <div className="shrink-0 border-t border-amber-900/40 px-1.5 py-1 space-y-1 bg-amber-950/40">
        <div
          className="bg-black/70 border border-gray-800 rounded px-2 py-1 text-[10px] text-amber-100 min-h-[1.75rem] leading-snug line-clamp-2"
          data-testid="tap-phraseology"
        >
          {preview.phraseology}
        </div>
        <button
          type="button"
          data-testid="tap-issue"
          disabled={!preview.hasElements}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            issue();
          }}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-black font-bold py-2 rounded text-sm"
        >
          ISSUE CLEARANCE
        </button>
      </div>
    </div>
  );
};

export default TapCommandPad;
