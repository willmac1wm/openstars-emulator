import React from 'react';
import type { ApproachProcedure, SimAircraft, WindState } from '../../sim/types';
import { fafPoint, gatePoint, pointAlongFinal } from '../../sim/geometry';
import { approachGateNmFromThreshold } from '../../sim/rules/intercept';
import { MAP_SIZE } from '../../constants';

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
  const outer = pointAlongFinal(approach, Math.max(gateNm + 8, 16));
  const thr = approach.threshold;

  const rangeMarks = [2, 4, 6, 8, 10, 12].map((nm) => pointAlongFinal(approach, nm));

  return (
    <svg
      data-testid="vtf-scope"
      viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
      className="w-full h-full bg-black"
    >
      {/* Extended centerline */}
      <line
        x1={thr.x}
        y1={thr.y}
        x2={outer.x}
        y2={outer.y}
        stroke={approach.kind === 'ILS' ? '#22c55e' : '#38bdf8'}
        strokeWidth={2}
        strokeDasharray={approach.kind === 'VOR' ? '8 6' : undefined}
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
      {rangeMarks.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="#4b5563" />
          <text x={p.x + 6} y={p.y - 4} fill="#6b7280" fontSize={10}>
            {i === 0 ? '' : `${[2, 4, 6, 8, 10, 12][i]}`}
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
      <text x={16} y={28} fill="#86efac" fontSize={12} fontFamily="monospace">
        {approach.kind} RWY {approach.runway} FAC {String(Math.round(approach.finalCourseDeg)).padStart(3, '0')}°
      </text>
      <text x={16} y={46} fill="#93c5fd" fontSize={11} fontFamily="monospace">
        WIND {wind.calm ? 'CALM' : `${String(Math.round(wind.fromDeg)).padStart(3, '0')}@${Math.round(wind.speedKt)}`}
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
