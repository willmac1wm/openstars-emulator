
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
  NM_3_PX
} from '../constants';
import DataBlock from './DataBlock';
import CompassRose from './CompassRose';

interface RadarScopeProps {
  aircraft: Aircraft[];
  onSelectAircraft: (id: string) => void;
  scanAngle: number; // For the sweeping line effect
  showPrimaryData: boolean; // Global data block toggle state
  highlightGateId?: string | null;
}

const RadarScope: React.FC<RadarScopeProps> = ({ aircraft, onSelectAircraft, scanAngle, showPrimaryData, highlightGateId = null }) => {
  
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
        
        const extLength = 60; 

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

                {/* Gate Label - MOVED TO OUTER END to avoid overlap with Fix */}
                <text 
                    x={(x1_out+x2_out)/2 + (dirX * 15)} 
                    y={(y1_out+y2_out)/2 + (dirY * 15)} 
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

  // Calculate sweep line coordinates
  const cx = MAP_SIZE / 2;
  const cy = MAP_SIZE / 2;
  const radius = 600; 
  const sweepX = cx + radius * Math.cos((scanAngle - 90) * (Math.PI / 180));
  const sweepY = cy + radius * Math.sin((scanAngle - 90) * (Math.PI / 180));

  return (
    <svg 
      viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`} 
      className="w-full h-full select-none bg-black block"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Background Grid / Range Rings */}
      <circle cx={cx} cy={cy} r={100} fill="none" stroke="#333" strokeWidth="1" opacity="0.2" />
      <circle cx={cx} cy={cy} r={200} fill="none" stroke="#333" strokeWidth="1" opacity="0.2" />
      <circle cx={cx} cy={cy} r={300} fill="none" stroke="#333" strokeWidth="1" opacity="0.2" />
      
      <CompassRose />

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

            {/* 3NM Separation Ring - Only for Alerted Aircraft */}
            {(ac.alertLevel === AlertLevel.WARNING || ac.alertLevel === AlertLevel.CRITICAL) && (
              <circle 
                  r={NM_3_PX} // 3NM Ring
                  fill="none"
                  stroke={symbolColor}
                  strokeWidth="1"
                  strokeDasharray={ac.alertLevel === AlertLevel.WARNING ? "4 4" : "0"}
                  opacity="0.8"
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
            <DataBlock aircraft={ac} showPrimaryInfo={showPrimaryData} />
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
