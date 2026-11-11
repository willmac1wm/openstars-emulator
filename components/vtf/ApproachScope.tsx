import React, { useMemo } from 'react';
import type { ApproachProcedure, SimAircraft, WindState } from '../../sim/types';
import { fafPoint, gatePoint, pointAlongFinal } from '../../sim/geometry';
import { approachGateNmFromThreshold } from '../../sim/rules/intercept';
import { MAP_SIZE } from '../../constants';
import CompassRose from '../CompassRose';

/** Drawn final length so controllers can see ~15–20 NM of centerline. */
export const VTF_FINAL_DRAW_NM = 20;
export const VTF_RANGE_MARKS_NM = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] as const;

interface Props {
  aircraft: SimAircraft[];
  approach: ApproachProcedure;
  wind: WindState;
  onSelect: (id: string) => void;
  selectedId: string | null;
}

const ApproachScope: React.FC<Props> = ({ aircraft, approach, wind, onSelect, selectedId }) => {
  const gateNm = approachGateNmFromThreshold(approach);
  const faf = fafPoint(approach);
  const gate = gatePoint(approach);
  const outerNm = Math.max(gateNm + 13, VTF_FINAL_DRAW_NM);
  const outer = pointAlongFinal(approach, outerNm);
  const thr = approach.threshold;

  const rangeMarks = VTF_RANGE_MARKS_NM.map((nm) => ({ nm, p: pointAlongFinal(approach, nm) }));

  // Frame the camera on threshold → outer final (+ pad) so 20 NM is readable.
  const view = useMemo(() => {
    const pad = 90;
    const xs = [thr.x, outer.x, faf.x, gate.x, ...aircraft.map((a) => a.x)];
    const ys = [thr.y, outer.y, faf.y, gate.y, ...aircraft.map((a) => a.y)];
    let minX = Math.min(...xs) - pad;
    let maxX = Math.max(...xs) + pad;
    let minY = Math.min(...ys) - pad;
    let maxY = Math.max(...ys) + pad;
    // Keep a square-ish framing so the compass rose stays readable.
    const w0 = maxX - minX;
    const h0 = maxY - minY;
    const side = Math.max(w0, h0, MAP_SIZE * 0.45);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    minX = cx - side / 2;
    maxX = cx + side / 2;
    minY = cy - side / 2;
    maxY = cy + side / 2;
    return { minX, minY, side, viewBox: `${minX} ${minY} ${side} ${side}` };
  }, [thr.x, thr.y, outer.x, outer.y, faf.x, faf.y, gate.x, gate.y, aircraft]);

  return (
    <svg
      data-testid="vtf-scope"
      viewBox={view.viewBox}
      className="w-full h-full bg-black"
    >
      <CompassRose size={view.side} originX={view.minX} originY={view.minY} />

      {/* Extended centerline (~20 NM) */}
      <line
        x1={thr.x}
        y1={thr.y}
        x2={outer.x}
        y2={outer.y}
        stroke={approach.kind === 'ILS' ? '#22c55e' : '#38bdf8'}
        strokeWidth={2}
        strokeDasharray={approach.kind === 'VOR' ? '8 6' : undefined}
        data-testid="vtf-final-line"
      />
      {/* Runway stub */}
      <line
        x1={thr.x}
        y1={thr.y}
        x2={thr.x + Math.cos(((approach.runwayHeadingDeg - 90) * Math.PI) / 180) * 40}
        y2={thr.y + Math.sin(((approach.runwayHeadingDeg - 90) * Math.PI) / 180) * 40}
        stroke="#e5e5e5"
        strokeWidth={6}
      />
      {rangeMarks.map(({ nm, p }) => (
        <g key={nm} data-testid={`vtf-range-${nm}`}>
          <circle cx={p.x} cy={p.y} r={3} fill="#4b5563" />
          <text x={p.x + 6} y={p.y - 4} fill="#9ca3af" fontSize={11} fontFamily="monospace">
            {nm}
          </text>
        </g>
      ))}
      {/* FAF */}
      <circle cx={faf.x} cy={faf.y} r={7} fill="none" stroke="#fbbf24" strokeWidth={2} />
      <text x={faf.x + 10} y={faf.y + 4} fill="#fbbf24" fontSize={11} fontFamily="monospace">
        FAF
      </text>
      {/* Approach gate */}
      <rect x={gate.x - 6} y={gate.y - 6} width={12} height={12} fill="none" stroke="#a78bfa" strokeWidth={2} />
      <text x={gate.x + 10} y={gate.y + 4} fill="#a78bfa" fontSize={11} fontFamily="monospace">
        GATE
      </text>
      <text x={view.minX + 16} y={view.minY + 28} fill="#86efac" fontSize={12} fontFamily="monospace">
        {approach.kind} RWY {approach.runway} FAC {String(Math.round(approach.finalCourseDeg)).padStart(3, '0')}°
      </text>
      <text x={view.minX + 16} y={view.minY + 46} fill="#93c5fd" fontSize={11} fontFamily="monospace">
        WIND {wind.calm ? 'CALM' : `${String(Math.round(wind.fromDeg)).padStart(3, '0')}@${Math.round(wind.speedKt)}`}
        {' · '}FINAL {outerNm} NM
      </text>

      {aircraft.map((ac) => (
        <g
          key={ac.id}
          transform={`translate(${ac.x}, ${ac.y})`}
          onClick={() => onSelect(ac.id)}
          className="cursor-pointer"
          data-testid={`vtf-target-${ac.callsign}`}
        >
          <polygon
            points="0,-8 6,8 -6,8"
            fill={ac.id === selectedId ? '#fff' : '#14F195'}
            transform={`rotate(${ac.heading})`}
          />
          <text x={10} y={-6} fill={ac.alertLevel >= 2 ? '#f87171' : '#e5e5e5'} fontSize={11} fontFamily="monospace">
            {ac.callsign} {ac.wake}
          </text>
          <text x={10} y={6} fill="#9ca3af" fontSize={10} fontFamily="monospace">
            {String(Math.round(ac.altitude)).padStart(3, '0')} {Math.round(ac.ias)}
          </text>
        </g>
      ))}
    </svg>
  );
};

export default ApproachScope;
