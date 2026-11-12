
import React, { useMemo } from 'react';
import { Aircraft, AlertLevel } from '../types';
import { 
  MAP_SIZE, 
  WAYPOINTS, 
  GATES,
  GATE_RADIUS,
  COLOR_SECONDARY, 
  COLOR_PRIMARY,
  COLOR_WARNING,
  COLOR_ALERT,
  CENTER,
} from '../constants';
import { nmToPx, separationRingRadiusPx } from '../sim/geometry';
import DataBlock from './DataBlock';

interface RadarScopeProps {
  aircraft: Aircraft[];
  onSelectAircraft: (id: string) => void;
  scanAngle: number; // For the sweeping line effect
  showPrimaryData: boolean; // Global data block toggle state
  /** When true, draw a 3 NM J-ring around every target. */
  showJRings?: boolean;
  highlightGateId?: string | null;
}

const JRING_R_PX = separationRingRadiusPx(3);

const RadarScope: React.FC<RadarScopeProps> = ({
  aircraft,
  onSelectAircraft,
  scanAngle,
  showPrimaryData,
  showJRings = false,
  highlightGateId = null,
}) => {
  
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

  return (
    <svg 
      viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`} 
      className="w-full h-full select-none bg-black block"
      preserveAspectRatio="xMidYMid meet"
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
          <g key={wp.id} transform={`translate(${wp.x}, ${wp.y})`}>
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

            {/* Current Position Symbol */}
            <g transform={`rotate(${ac.heading})`}>
               <line x1="0" y1="0" x2="0" y2="-25" stroke={symbolColor} strokeWidth="1" />
            </g>
            
            {/* UPDATED: Round Blue Ball Radius 4.5 */}
            <circle cx="0" cy="0" r="4.5" fill={dotColor} />
            
            {isSelected && (
               <circle r="15" fill="none" stroke="white" strokeDasharray="2 2" className="animate-spin-slow" />
            )}

            {/* Data Block */}
            <DataBlock aircraft={ac} showPrimaryInfo={showPrimaryData} labelOffset={labelOffsets.get(ac.id)} />
          </g>
        );
      })}

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
