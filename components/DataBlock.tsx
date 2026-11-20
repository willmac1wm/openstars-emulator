
import React from 'react';
import { Aircraft, AlertLevel } from '../types';
import { COLOR_PRIMARY, COLOR_WARNING, COLOR_ALERT, MAP_SIZE } from '../constants';

interface DataBlockProps {
  aircraft: Aircraft;
  showPrimaryInfo: boolean;
  /** Extra shift (px, scope coords) applied to de-conflict stacked labels. */
  labelOffset?: { dx: number; dy: number };
  /** STARS trackball offset: swing leader line to next 45° compass direction. */
  onOffsetLeader?: (id: string, nextDir: number) => void;
}

const DataBlock: React.FC<DataBlockProps> = ({ aircraft, showPrimaryInfo, labelOffset, onOffsetLeader }) => {
  const { callsign, altitude, speed, status, isSelected, targetAltitude, destination, type, alertLevel, dataBlockDir, handoffResult } = aircraft;
  
  // Determine Color
  let color = COLOR_PRIMARY;
  
  if (status === 'CRASH') color = COLOR_ALERT;
  else if (status === 'SEPARATION_LOSS') color = COLOR_ALERT;
  else if (alertLevel === AlertLevel.CRITICAL) color = COLOR_ALERT;
  else if (alertLevel === AlertLevel.WARNING) color = COLOR_WARNING;
  else if (status === 'HANDOFF') {
      // Special coloring for handoff result
      if (handoffResult === 'CLEAN EXIT') color = '#4ade80'; // Green
      else if (handoffResult === 'SLOPPY EXIT') color = '#facc15'; // Yellow
      else color = COLOR_ALERT; // Red for errors
  }
  else if (isSelected) color = '#ffffff';

  // Format strings
  const altCurrent = Math.floor(altitude).toString().padStart(3, '0');
  
  // Display logic:
  // Row 1: Callsign
  // Row 2 Left: [Altitude] OR [Destination]
  // Row 2 Right: [Speed] OR [Type]
  
  const leftField = showPrimaryInfo ? altCurrent : destination;
  
  // Speed in 10s of knots (250 -> 25)
  const spdStr = Math.floor(speed / 10).toString();
  const rightField = showPrimaryInfo ? spdStr : type;

  // Leader line calculation
  // Use the aircraft's assigned direction
  const leaderLength = 35;
  const angleRad = (dataBlockDir) * (Math.PI / 180); 
  const rawX = Math.cos(angleRad) * leaderLength;
  const rawY = Math.sin(angleRad) * leaderLength;

  // Clamp the block inside the scope: flip the leader away from the edge it
  // would cross (text is ~90px wide, ~28px tall). Previously blocks at the
  // scope edge were cut off (e.g. UAL123 east, DAL456 west).
  const BLOCK_W = 92;
  const BLOCK_H = 30;
  let lineX = rawX + (labelOffset?.dx ?? 0);
  let lineY = rawY + (labelOffset?.dy ?? 0);
  if (aircraft.x + lineX + BLOCK_W > MAP_SIZE) lineX = -Math.abs(rawX) + (labelOffset?.dx ?? 0);
  if (aircraft.x + lineX < 4) lineX = Math.abs(rawX) + (labelOffset?.dx ?? 0);
  if (aircraft.y + lineY + BLOCK_H > MAP_SIZE) lineY = -Math.abs(rawY) + (labelOffset?.dy ?? 0);
  if (aircraft.y + lineY < 10) lineY = Math.abs(rawY) + (labelOffset?.dy ?? 0);

  const isClimbingOrDescending = Math.abs(targetAltitude - altitude) > 0.5;
  const targetAltStr = Math.round(targetAltitude).toString().padStart(3, '0');

  return (
    <g>
      {/* Leader Line */}
      <line 
        x1={0} y1={0} 
        x2={lineX} y2={lineY} 
        stroke={color} 
        strokeWidth="1" 
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Data Block Text Group — right-click rotates leader line 45° (STARS offset) */}
      <g
        transform={`translate(${lineX}, ${lineY})`}
        onContextMenu={(e) => {
          if (!onOffsetLeader) return;
          e.preventDefault();
          e.stopPropagation();
          const nextDir = (Math.round(dataBlockDir / 45) * 45 + 45) % 360;
          onOffsetLeader(aircraft.id, nextDir);
        }}
        style={{ cursor: onOffsetLeader ? 'pointer' : 'default' }}
      >
        {/* Invisible hit target for easy right-click leader offset */}
        <rect x="0" y="-12" width="96" height="30" fill="transparent" />
        
        {/* Row 1: Callsign + assigned altitude arrow when climbing/descending */}
        <text 
          x="5" 
          y="0" 
          fill={color} 
          fontSize="14" 
          fontWeight="bold" 
          fontFamily="monospace"
          style={{ letterSpacing: '1px', pointerEvents: 'none' }}
        >
          {callsign}
        </text>
        
        {status === 'HANDOFF' && handoffResult ? (
             /* Handoff Result Row */
             <text 
                x="5" 
                y="14" 
                fill={color} 
                fontSize="12" 
                fontWeight="bold"
                fontFamily="monospace"
                style={{ pointerEvents: 'none' }}
            >
                {handoffResult}
            </text>
        ) : (
            /* Normal Data Row — authentic STARS 2-line time-sharing */
            <>
                {/* Row 2: [Alt/Dest] space [Speed/Type] */}
                <text 
                  x="5" 
                  y="14" 
                  fill={color} 
                  fontSize="14" 
                  fontFamily="monospace"
                  style={{ letterSpacing: '1px', pointerEvents: 'none' }}
                >
                  <tspan>{leftField}</tspan>
                  <tspan x="45">{rightField}</tspan>
                </text>
                
                {/* Climb/Descent trend + assigned altitude */}
                {isClimbingOrDescending && (
                     <text x="74" y="0" fill={color} fontSize="10" fontFamily="monospace" style={{ pointerEvents: 'none' }}>
                         {targetAltitude > altitude ? `↑${targetAltStr}` : `↓${targetAltStr}`}
                     </text>
                )}
            </>
        )}

      </g>
    </g>
  );
};

export default DataBlock;
