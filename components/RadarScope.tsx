
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Aircraft, AlertLevel } from '../types';
import {
  MAP_SIZE,
  WAYPOINTS,
  GATES,
  GATE_RADIUS,
  NM_TO_PX,
  COLOR_SECONDARY,
  COLOR_PRIMARY,
  COLOR_WARNING,
  COLOR_ALERT,
  CENTER,
} from '../constants';
import { gateAltLabel } from '../services/exitScoring';
import { nmToPx, separationRingRadiusPx } from '../sim/geometry';
import DataBlock from './DataBlock';

interface RblPoint {
  x: number;
  y: number;
  /** Optional aircraft id so the RBL anchor tracks the moving target. */
  aircraftId?: string;
}

interface RadarScopeProps {
  aircraft: Aircraft[];
  onSelectAircraft: (id: string) => void;
  scanAngle: number; // For the sweeping line effect
  showPrimaryData: boolean; // Global data block toggle state
  /** When true, draw a 3 NM J-ring around every target. */
  showJRings?: boolean;
  highlightGateId?: string | null;
  /** Predicted Track Line length in minutes (1, 2, or 3). */
  ptlMinutes?: number;
  /** Splat T (*T) Range/Bearing Line mode active. */
  rblMode?: boolean;
  onExitRblMode?: () => void;
  /** Double-click a gate fix to vector the selected aircraft direct. */
  onDirectToFix?: (fixId: string, headingDeg: number) => void;
  /** Right-click a data block to rotate its leader line (STARS offset). */
  onOffsetLeader?: (id: string, nextDir: number) => void;
}

const JRING_R_PX = separationRingRadiusPx(3);

function computeBearingDeg(from: { x: number; y: number }, to: { x: number; y: number }): number {
  let deg = Math.round((Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI);
  if (deg <= 0) deg += 360;
  return deg;
}

const RadarScope: React.FC<RadarScopeProps> = ({
  aircraft,
  onSelectAircraft,
  scanAngle,
  showPrimaryData,
  showJRings = false,
  highlightGateId = null,
  ptlMinutes = 1,
  rblMode = false,
  onExitRblMode,
  onDirectToFix,
  onOffsetLeader,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [rblStart, setRblStart] = useState<RblPoint | null>(null);
  const [rblEnd, setRblEnd] = useState<RblPoint | null>(null);
  const [rblPinned, setRblPinned] = useState(false);
  const draggingRblRef = useRef(false);

  // Esc clears any active or pinned RBL line immediately.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        draggingRblRef.current = false;
        setRblStart(null);
        setRblEnd(null);
        setRblPinned(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Re-opening RBL clears the previous pinned line so you start fresh.
  useEffect(() => {
    if (rblMode && rblPinned) {
      setRblStart(null);
      setRblEnd(null);
      setRblPinned(false);
    }
  }, [rblMode, rblPinned]);

  const clientToSvg = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const scale = Math.min(rect.width / MAP_SIZE, rect.height / MAP_SIZE);
    const offsetX = (rect.width - MAP_SIZE * scale) / 2;
    const offsetY = (rect.height - MAP_SIZE * scale) / 2;
    return {
      x: Math.max(0, Math.min(MAP_SIZE, (clientX - rect.left - offsetX) / scale)),
      y: Math.max(0, Math.min(MAP_SIZE, (clientY - rect.top - offsetY) / scale)),
    };
  };

  const resolveRblPoint = (pt: RblPoint | null): { x: number; y: number } | null => {
    if (!pt) return null;
    if (pt.aircraftId) {
      const ac = aircraft.find((a) => a.id === pt.aircraftId);
      if (ac) return { x: ac.x, y: ac.y };
    }
    return { x: pt.x, y: pt.y };
  };

  const snapToNearestTarget = (pos: { x: number; y: number }): RblPoint => {
    let bestAc: Aircraft | null = null;
    let bestDist = 22;
    for (const ac of aircraft) {
      const d = Math.hypot(ac.x - pos.x, ac.y - pos.y);
      if (d < bestDist) {
        bestDist = d;
        bestAc = ac;
      }
    }
    if (bestAc) return { x: bestAc.x, y: bestAc.y, aircraftId: bestAc.id };
    for (const wp of WAYPOINTS) {
      if (Math.hypot(wp.x - pos.x, wp.y - pos.y) < 18) {
        return { x: wp.x, y: wp.y };
      }
    }
    return pos;
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const wantRbl = rblMode || e.shiftKey;
    if (!wantRbl) {
      if (rblPinned) {
        setRblStart(null);
        setRblEnd(null);
        setRblPinned(false);
      }
      return;
    }
    const pos = clientToSvg(e.clientX, e.clientY);
    if (!pos) return;
    e.preventDefault();
    e.stopPropagation();
    const snapped = snapToNearestTarget(pos);
    // In RBL mode, support both click-to-click (trackpad friendly) and click-and-drag:
    // If we already placed point A via a click, a second click places point B and pins it.
    if (rblMode && rblStart && !draggingRblRef.current && !rblPinned) {
      setRblEnd(snapped);
      setRblPinned(true);
      onExitRblMode?.();
      return;
    }
    setRblStart(snapped);
    setRblEnd(snapped);
    setRblPinned(false);
    draggingRblRef.current = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const trackingClickToClick = rblMode && Boolean(rblStart) && !rblPinned;
    if (!draggingRblRef.current && !trackingClickToClick) return;
    const pos = clientToSvg(e.clientX, e.clientY);
    if (!pos) return;
    setRblEnd(snapToNearestTarget(pos));
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRblRef.current) return;
    draggingRblRef.current = false;
    const pos = clientToSvg(e.clientX, e.clientY);
    if (!pos) return;
    const snapped = snapToNearestTarget(pos);
    const draggedDist = rblStart ? Math.hypot(snapped.x - rblStart.x, snapped.y - rblStart.y) : 0;
    if (rblMode) {
      if (draggedDist > 10) {
        // Finished a drag in RBL mode → pin the measurement.
        setRblEnd(snapped);
        setRblPinned(true);
        onExitRblMode?.();
      }
      // If it was just a tap/click (draggedDist <= 10), stay in RBL mode waiting for the 2nd click!
    } else {
      // Shift-drag clears on release.
      setRblStart(null);
      setRblEnd(null);
    }
  };
  
  // Render Gates (Exit Lines)
  const gateLines = useMemo(() => {
    return GATES.map((gate) => {
        const active = highlightGateId === gate.id;
        // Angles to radians
        const radStart = (gate.startAngle - 90) * (Math.PI / 180);
        const radEnd = (gate.endAngle - 90) * (Math.PI / 180);

        // Inner points
        const x1 = CENTER + GATE_RADIUS * Math.cos(radStart);
        const y1 = CENTER + GATE_RADIUS * Math.sin(radStart);
        const x2 = CENTER + GATE_RADIUS * Math.cos(radEnd);
        const y2 = CENTER + GATE_RADIUS * Math.sin(radEnd);

        const midAngle = (gate.startAngle + gate.endAngle) / 2;
        const radMid = (midAngle - 90) * (Math.PI / 180);
        const dirX = Math.cos(radMid);
        const dirY = Math.sin(radMid);
        
        const extLength = 40; // Keep corridor ends inside the 800px scope (60px clipped past the edge).

        const x1_out = x1 + dirX * extLength;
        const y1_out = y1 + dirY * extLength;
        const x2_out = x2 + dirX * extLength;
        const y2_out = y2 + dirY * extLength;
        const stroke = active ? COLOR_PRIMARY : COLOR_SECONDARY;

        return (
            <g key={`gate-${gate.id}`} data-gate={gate.id} data-active={active ? 'true' : 'false'}>
                {/* Parallel Corridor Lines */}
                <line 
                    x1={x1} y1={y1} 
                    x2={x1_out} y2={y1_out} 
                    stroke={stroke} 
                    strokeWidth={active ? 3 : 2} 
                    opacity={active ? 0.95 : 0.7}
                    className={active ? 'gate-target' : undefined}
                />
                <line 
                    x1={x2} y1={y2} 
                    x2={x2_out} y2={y2_out} 
                    stroke={stroke} 
                    strokeWidth={active ? 3 : 2} 
                    opacity={active ? 0.95 : 0.7}
                    className={active ? 'gate-target' : undefined}
                />

                {/* The Gate Threshold / Boundary (Broken, Dimmer) */}
                <line 
                    x1={x1} y1={y1} 
                    x2={x2} y2={y2} 
                    stroke={stroke} 
                    strokeWidth={active ? 3 : 2} 
                    strokeDasharray="6 6"
                    opacity={active ? 0.7 : 0.3}
                />

                {/* Gate Label - clamped inside the scope so EAST/WEST/SOUTH
                    no longer clip to "EA"/"ST" at the viewBox edge. */}
                <text
                    x={Math.min(Math.max((x1_out+x2_out)/2 + (dirX * 15), 34), MAP_SIZE - 34)}
                    y={Math.min(Math.max((y1_out+y2_out)/2 + (dirY * 15), 16), MAP_SIZE - 16)}
                    fill={stroke}
                    fontSize={active ? 14 : 12}
                    opacity={active ? 1 : 0.6}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fontWeight="bold"
                    style={{ letterSpacing: '1px' }}
                >
                    {gate.label}
                </text>
                {/* Legal exit altitudes for this gate — shown on the scope
                    where the player needs them (was a menu line). Clamped
                    wider than the gate name: the alt text is ~90px wide, so
                    a 34px clamp still clips it on the WEST gate. */}
                <text
                    data-testid={`gate-alt-${gate.id}`}
                    x={Math.min(Math.max((x1_out+x2_out)/2 + (dirX * 15), 50), MAP_SIZE - 50)}
                    y={Math.min(Math.max((y1_out+y2_out)/2 + (dirY * 15) + 16, 30), MAP_SIZE - 8)}
                    fill={stroke}
                    fontSize={10}
                    opacity={active ? 0.95 : 0.55}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fontWeight="bold"
                    style={{ letterSpacing: '1px' }}
                >
                    {gateAltLabel(gate.id)}
                </text>
            </g>
        );
    });
  }, [highlightGateId]);

  // Realistic STARS-like square edge compass markings
  const compassTicks = useMemo(() => {
    const ticks = [];
    const center = MAP_SIZE / 2;
    // Removed padding so ticks touch the absolute edge
    const padding = 0; 
    const size = MAP_SIZE - (padding * 2);
    const origin = padding;
    const max = MAP_SIZE - padding;
    
    for (let deg = 0; deg < 360; deg += 10) {
        if (deg % 10 !== 0) continue; 

        const rad = (deg - 90) * (Math.PI / 180); 
        const dx = Math.sin(deg * (Math.PI / 180));
        const dy = -Math.cos(deg * (Math.PI / 180));
        
        let t = Infinity;
        
        // Calculate intersection with the square bounds (origin to max)
        if (dx > 0) { const tR = (max - center) / dx; if (tR < t) t = tR; }
        if (dx < 0) { const tL = (origin - center) / dx; if (tL < t) t = tL; }
        if (dy > 0) { const tB = (max - center) / dy; if (tB < t) t = tB; }
        if (dy < 0) { const tT = (origin - center) / dy; if (tT < t) t = tT; }

        const xEdge = center + dx * t;
        const yEdge = center + dy * t;
        
        const tickLen = 12;
        let x1 = xEdge, y1 = yEdge, x2 = xEdge, y2 = yEdge;
        
        const isRight = Math.abs(xEdge - max) < 1;
        const isLeft = Math.abs(xEdge - origin) < 1;
        const isBottom = Math.abs(yEdge - max) < 1;
        const isTop = Math.abs(yEdge - origin) < 1;

        // Draw tick inwards from edge
        if (isRight) x2 = xEdge - tickLen;
        else if (isLeft) x2 = xEdge + tickLen;
        if (isBottom) y2 = yEdge - tickLen;
        else if (isTop) y2 = yEdge + tickLen;

        if (!isRight && !isLeft && !isBottom && !isTop) {
             x2 = center + dx * (t - tickLen);
             y2 = center + dy * (t - tickLen);
        }

        ticks.push(
            <line 
              key={`tick-${deg}`} 
              x1={x1} y1={y1} 
              x2={x2} y2={y2} 
              stroke={COLOR_SECONDARY} 
              strokeWidth="2" 
            />
        );

        const textOffset = 28;
        let tx = xEdge, ty = yEdge;
        if (isRight) tx -= textOffset;
        else if (isLeft) tx += textOffset;
        if (isBottom) ty -= textOffset;
        else if (isTop) ty += textOffset;
        
        if (deg % 90 === 0) {
            if (deg === 45) { tx -= 10; ty += 10; }
        }

        const label = deg === 0 ? "360" : deg.toString().padStart(3, '0');

        ticks.push(
            <text
                key={`lbl-${deg}`}
                x={tx} y={ty}
                fill={COLOR_SECONDARY}
                fontSize="14"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
                alignmentBaseline="middle"
            >
                {label}
            </text>
        );
    }
    return ticks;
  }, []);

  // Calculate sweep line coordinates
  const cx = MAP_SIZE / 2;
  const cy = MAP_SIZE / 2;
  const radius = 600; 
  const sweepX = cx + radius * Math.cos((scanAngle - 90) * (Math.PI / 180));
  const sweepY = cy + radius * Math.sin((scanAngle - 90) * (Math.PI / 180));

  // De-conflict datablocks: when two labels would land on top of each other
  // (aircraft clustered near the centre), stack the later one down in 34px
  // steps so callsigns stay readable instead of rendering garbled together.
  const labelOffsets = useMemo(() => {
    const placed: { x: number; y: number }[] = [];
    const offsets = new Map<string, { dx: number; dy: number }>();
    for (const ac of aircraft) {
      const rad = (ac.dataBlockDir * Math.PI) / 180;
      const ax0 = ac.x + Math.cos(rad) * 35;
      const ay0 = ac.y + Math.sin(rad) * 35;
      let ay = ay0;
      let shift = 0;
      for (let tries = 0; tries < 4; tries++) {
        const clash = placed.some((p) => Math.abs(p.x - ax0) < 95 && Math.abs(p.y - ay) < 30);
        if (!clash) break;
        shift += 34;
        ay += 34;
      }
      placed.push({ x: ax0, y: ay });
      offsets.set(ac.id, { dx: 0, dy: shift });
    }
    return offsets;
  }, [aircraft]);

  const rblA = resolveRblPoint(rblStart);
  const rblB = resolveRblPoint(rblEnd);
  const showRbl = Boolean(rblA && rblB && Math.hypot(rblB.x - rblA.x, rblB.y - rblA.y) > 4);
  const rblDistNm = showRbl && rblA && rblB ? Math.hypot(rblB.x - rblA.x, rblB.y - rblA.y) / NM_TO_PX : 0;
  const rblBearing = showRbl && rblA && rblB ? computeBearingDeg(rblA, rblB) : 0;
  const selectedAc = aircraft.find((a) => a.isSelected) || null;

  return (
    <svg 
      ref={svgRef}
      viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`} 
      className={`w-full h-full select-none bg-black block ${rblMode ? 'cursor-crosshair' : ''}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={handleSvgPointerDown}
      onPointerMove={handleSvgPointerMove}
      onPointerUp={handleSvgPointerUp}
      onPointerCancel={handleSvgPointerUp}
    >
      {/* Background Grid / Range Rings (10 / 20 / 30 NM — same NM→px as J-rings) */}
      <circle cx={cx} cy={cy} r={nmToPx(10)} fill="none" stroke="#333" strokeWidth="1" opacity="0.2" />
      <circle cx={cx} cy={cy} r={nmToPx(20)} fill="none" stroke="#333" strokeWidth="1" opacity="0.2" />
      <circle cx={cx} cy={cy} r={nmToPx(30)} fill="none" stroke="#333" strokeWidth="1" opacity="0.2" />
      
      {compassTicks}

      {/* Map Layers */}
      <g id="map-layer">
        {gateLines}
        {WAYPOINTS.map(wp => (
          <g
            key={wp.id}
            transform={`translate(${wp.x}, ${wp.y})`}
            className={selectedAc && onDirectToFix ? 'cursor-pointer' : undefined}
            onDoubleClick={(e) => {
              if (!selectedAc || !onDirectToFix) return;
              e.stopPropagation();
              const hdg = computeBearingDeg({ x: selectedAc.x, y: selectedAc.y }, { x: wp.x, y: wp.y });
              onDirectToFix(wp.id, hdg);
            }}
          >
            {/* Larger hit area for easy double-click direct-to */}
            <circle cx="0" cy="0" r="16" fill="transparent" />
            {wp.type === 'VOR' ? (
               <path d="M-6,5 L0,-7 L6,5 M-6,5 L6,5" fill="none" stroke={COLOR_SECONDARY} strokeWidth="1.5"/>
            ) : (
               <path d="M-5,0 L5,0 M0,-5 L0,5" stroke={COLOR_SECONDARY} strokeWidth="1.5" />
            )}
            <text x="8" y="-8" fill={COLOR_SECONDARY} fontSize="11" fontWeight="bold" opacity="0.8">{wp.id}</text>
          </g>
        ))}
      </g>

      {/* Aircraft Layer */}
      {aircraft.map(ac => {
        const isSelected = ac.isSelected;
        let symbolColor = COLOR_PRIMARY;
        
        if (ac.status === 'CRASH') symbolColor = COLOR_ALERT;
        else if (ac.alertLevel === AlertLevel.CRITICAL) symbolColor = COLOR_ALERT;
        else if (ac.alertLevel === AlertLevel.WARNING) symbolColor = COLOR_WARNING;
        else if (isSelected) symbolColor = '#ffffff';
        
        // UPDATED: Round Blue Ball for normal aircraft, radius increased to 4.5
        const dotColor = (ac.status !== 'CRASH' && ac.alertLevel === AlertLevel.NONE && !isSelected) 
            ? '#3b82f6' // Blue
            : symbolColor; // Status color (Red/Yellow/White)

        return (
          <g 
            key={ac.id} 
            data-callsign={ac.callsign}
            data-testid={`aircraft-${ac.callsign}`}
            data-status={ac.status}
            data-heading={ac.heading}
            transform={`translate(${ac.x}, ${ac.y})`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectAircraft(ac.id);
            }}
            className="cursor-pointer hover:opacity-100 transition-opacity duration-75"
            style={{ opacity: ac.status === 'CRASH' ? 0.5 : 1 }}
          >
            {/* History Trails */}
            {ac.history.map((pos, hIdx) => (
              <circle 
                key={hIdx} 
                cx={pos.x - ac.x} 
                cy={pos.y - ac.y} 
                r={1.5} 
                fill={symbolColor} 
                opacity={0.3 + (hIdx * 0.15)} 
              />
            ))}

            {/* 3 NM J-ring (toggle) or conflict separation cue */}
            {(showJRings
              || ac.alertLevel === AlertLevel.WARNING
              || ac.alertLevel === AlertLevel.CRITICAL) && (
              <circle
                data-testid={showJRings ? 'jring-3nm' : 'sep-ring-alert'}
                r={JRING_R_PX}
                fill="none"
                stroke={
                  ac.alertLevel === AlertLevel.CRITICAL || ac.alertLevel === AlertLevel.WARNING
                    ? symbolColor
                    : '#3d5c4a'
                }
                strokeWidth={ac.alertLevel === AlertLevel.CRITICAL ? 1.25 : 1}
                strokeDasharray={
                  !showJRings && ac.alertLevel === AlertLevel.WARNING ? '4 4' : undefined
                }
                opacity={
                  ac.alertLevel === AlertLevel.CRITICAL || ac.alertLevel === AlertLevel.WARNING
                    ? 0.85
                    : 0.45
                }
              />
            )}

            {/* True Speed-Scaled STARS Predicted Track Line (PTL): (speed/60) * ptlMinutes NM */}
            <g transform={`rotate(${ac.heading})`}>
               <line
                 data-testid="ptl-vector"
                 x1="0"
                 y1="0"
                 x2="0"
                 y2={-Math.max(12, (ac.speed / 60) * ptlMinutes * NM_TO_PX)}
                 stroke={symbolColor}
                 strokeWidth="1.25"
                 opacity="0.85"
               />
            </g>
            
            {/* UPDATED: Round Blue Ball Radius 4.5 */}
            <circle cx="0" cy="0" r="4.5" fill={dotColor} />
            
            {isSelected && (
               <circle r="15" fill="none" stroke="white" strokeDasharray="2 2" className="animate-spin-slow" />
            )}

            {/* Data Block */}
            <DataBlock
              aircraft={ac}
              showPrimaryInfo={showPrimaryData}
              labelOffset={labelOffsets.get(ac.id)}
              onOffsetLeader={onOffsetLeader}
            />
          </g>
        );
      })}

      {/* Splat T (*T) STARS Range/Bearing Line (RBL) */}
      {showRbl && rblA && rblB && (
        <g data-testid="rbl-overlay" style={{ pointerEvents: 'none' }}>
          <line
            x1={rblA.x}
            y1={rblA.y}
            x2={rblB.x}
            y2={rblB.y}
            stroke="#22d3ee"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <circle cx={rblA.x} cy={rblA.y} r="3" fill="#22d3ee" />
          <circle cx={rblB.x} cy={rblB.y} r="3" fill="#22d3ee" />
          <g transform={`translate(${(rblA.x + rblB.x) / 2}, ${(rblA.y + rblB.y) / 2 - 10})`}>
            <rect x="-56" y="-12" width="112" height="18" rx="3" fill="rgba(0,0,0,0.85)" stroke="#0891b2" strokeWidth="1" />
            <text
              x="0"
              y="1"
              fill="#67e8f9"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {String(rblBearing).padStart(3, '0')}° / {rblDistNm.toFixed(1)} NM
            </text>
          </g>
        </g>
      )}

      {/* Radar Sweep Line */}
      <line 
        x1={cx} y1={cy} 
        x2={sweepX} y2={sweepY} 
        stroke="rgba(20, 241, 149, 0.3)" 
        strokeWidth="2"
        style={{ filter: 'blur(2px)' }}
      />
      
    </svg>
  );
};

export default RadarScope;
