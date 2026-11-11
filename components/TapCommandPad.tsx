import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Aircraft } from '../types';
import { ALTS_NORTH_EAST, ALTS_SOUTH_WEST } from '../constants';
import { prewarmReadback } from '../services/pilotVoice';
import {
  composeTapClearance,
  normalizeHeadingDeg,
  snapHeading5,
} from '../services/tapClearance';

interface TapCommandPadProps {
  aircraft: Aircraft | null;
  onIssue: (command: string) => void;
}

/** Compact enough that dial + chips + sticky Issue fit at 1024×640 without inner scroll. */
const DIAL_SIZE = 112;
const DIAL_R = DIAL_SIZE / 2 - 6;

function angleFromPointer(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  // 0° = north (up), clockwise
  const rad = Math.atan2(clientX - cx, cy - clientY);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return snapHeading5(deg);
}

const TapCommandPad: React.FC<TapCommandPadProps> = ({ aircraft, onIssue }) => {
  const [heading, setHeading] = useState<number | null>(null);
  const [turnForced, setTurnForced] = useState<'LEFT' | 'RIGHT' | null>(null);
  const [altitude, setAltitude] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const dialRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);

  const legalAlts = aircraft
    ? (aircraft.destination === 'NOR' || aircraft.destination === 'EAS' ? ALTS_NORTH_EAST : ALTS_SOUTH_WEST)
    : ALTS_SOUTH_WEST;

  // Reset pad when the selected aircraft changes.
  useEffect(() => {
    setHeading(null);
    setTurnForced(null);
    setAltitude(null);
    setSpeed(null);
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
    onIssue(preview.command);
    setHeading(null);
    setTurnForced(null);
    setAltitude(null);
    setSpeed(null);
  }, [onIssue, preview.command, preview.hasElements]);

  // Enter issues the built clearance (when pad is active / aircraft selected).
  useEffect(() => {
    if (!aircraft) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      // Don't steal Enter from the typed command input.
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!preview.hasElements) return;
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
    setHeading(next);
    // Changing the dial clears any forced turn → back to shortest.
    setTurnForced(null);
  }, []);

  const onDialPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    applyDialPoint(e.clientX, e.clientY);
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

  return (
    <div
      className="border border-amber-700/50 bg-amber-950/20 rounded flex flex-col min-h-0 flex-1"
      data-testid="tap-command-pad"
    >
      {/* Build area — sized to fit at 1024×640 with sticky Issue; overflow only as last resort */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1.5 pt-1 pb-0.5 space-y-1" data-testid="tap-build-area">
        <div className="text-[8px] uppercase tracking-wider text-amber-300 leading-none">
          Tap clearance · shortest turn
        </div>

        <div className="flex items-start gap-1.5">
          {/* Compact compass dial */}
          <div className="shrink-0 relative" style={{ width: DIAL_SIZE, height: DIAL_SIZE }}>
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
                stroke="#365314"
                strokeWidth={2}
              />
              {[0, 90, 180, 270].map((deg) => {
                const rad = ((deg - 90) * Math.PI) / 180;
                const x1 = DIAL_SIZE / 2 + Math.cos(rad) * (DIAL_R - 8);
                const y1 = DIAL_SIZE / 2 + Math.sin(rad) * (DIAL_R - 8);
                const x2 = DIAL_SIZE / 2 + Math.cos(rad) * DIAL_R;
                const y2 = DIAL_SIZE / 2 + Math.sin(rad) * DIAL_R;
                return (
                  <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#84cc16" strokeWidth={2} />
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
                  <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3f6212" strokeWidth={1} />
                );
              })}
              <text x={DIAL_SIZE / 2} y={14} textAnchor="middle" fill="#a3e635" fontSize={8} fontFamily="monospace">
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
                  points={`${DIAL_SIZE / 2},${DIAL_SIZE / 2 - DIAL_R + 12} ${DIAL_SIZE / 2 - 4},${DIAL_SIZE / 2 + 3} ${DIAL_SIZE / 2 + 4},${DIAL_SIZE / 2 + 3}`}
                  fill={targetHdg != null ? '#fbbf24' : '#4b5563'}
                  data-testid="heading-needle"
                />
              </g>
              <circle cx={DIAL_SIZE / 2} cy={DIAL_SIZE / 2} r={3} fill="#e5e7eb" />
            </svg>
            <div
              className="absolute inset-x-0 bottom-0.5 text-center font-mono text-[10px] text-amber-100 pointer-events-none"
              data-testid="heading-readout"
            >
              {targetHdg != null
                ? `H${String(targetHdg).padStart(3, '0')}`
                : `— ${String(currentHdg).padStart(3, '0')} —`}
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="grid grid-cols-2 gap-0.5">
              <button
                type="button"
                data-testid="turn-left"
                className={`py-1 rounded border text-[10px] font-bold ${
                  turnForced === 'LEFT'
                    ? 'bg-green-800 border-green-500 text-white'
                    : autoTurn === 'LEFT' && targetHdg != null && turnForced == null
                      ? 'border-green-700/70 text-green-300'
                      : 'border-gray-700 text-gray-400'
                }`}
                onClick={() => setTurnForced((prev) => (prev === 'LEFT' ? null : 'LEFT'))}
              >
                LEFT
              </button>
              <button
                type="button"
                data-testid="turn-right"
                className={`py-1 rounded border text-[10px] font-bold ${
                  turnForced === 'RIGHT'
                    ? 'bg-green-800 border-green-500 text-white'
                    : autoTurn === 'RIGHT' && targetHdg != null && turnForced == null
                      ? 'border-green-700/70 text-green-300'
                      : 'border-gray-700 text-gray-400'
                }`}
                onClick={() => setTurnForced((prev) => (prev === 'RIGHT' ? null : 'RIGHT'))}
              >
                RIGHT
              </button>
            </div>
            <div className="text-[8px] text-gray-500 leading-tight truncate" data-testid="turn-hint">
              {targetHdg == null
                ? 'Dial heading — shortest turn'
                : turnForced
                  ? `Forced ${turnForced.toLowerCase()} (dial resets)`
                  : autoTurn
                    ? `Shortest: ${autoTurn.toLowerCase()}`
                    : 'Already on heading'}
            </div>

            <div className="flex flex-wrap gap-0.5">
              {legalAlts.map((alt) => (
                <button
                  key={alt}
                  type="button"
                  data-testid={`alt-${alt}`}
                  onClick={() => toggleAltitude(alt)}
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${
                    altitude === alt
                      ? 'bg-green-800 border-green-500 text-white'
                      : 'border-gray-700 text-gray-400'
                  }`}
                >
                  A{String(alt).padStart(3, '0')}
                </button>
              ))}
              {[180, 210, 250].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  data-testid={`spd-${spd}`}
                  onClick={() => toggleSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${
                    speed === spd
                      ? 'bg-green-800 border-green-500 text-white'
                      : 'border-gray-700 text-gray-400'
                  }`}
                >
                  S{spd}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky preview + ISSUE — always visible at bottom of pad */}
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
          onClick={issue}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-black font-bold py-2 rounded text-sm"
        >
          ISSUE CLEARANCE
        </button>
      </div>
    </div>
  );
};

export default TapCommandPad;
