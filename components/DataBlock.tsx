
import React from 'react';
import { Aircraft, AlertLevel } from '../types';
import { COLOR_PRIMARY, COLOR_WARNING, COLOR_ALERT } from '../constants';

interface DataBlockProps {
  aircraft: Aircraft;
  showPrimaryInfo: boolean;
}

const DataBlock: React.FC<DataBlockProps> = ({ aircraft, showPrimaryInfo }) => {
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
  const lineX = Math.cos(angleRad) * leaderLength;
  const lineY = Math.sin(angleRad) * leaderLength;

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Leader Line */}
      <line 
        x1={0} y1={0} 
        x2={lineX} y2={lineY} 
        stroke={color} 
        strokeWidth="1" 
      />
      
      {/* Data Block Text Group */}
      <g transform={`translate(${lineX}, ${lineY})`}>
        
        {/* Row 1: Callsign */}
        <text 
          x="5" 
          y="0" 
          fill={color} 
          fontSize="14" 
          fontWeight="bold" 
          fontFamily="monospace"
          style={{ letterSpacing: '1px' }}
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
            >
                {handoffResult}
            </text>
        ) : (
            /* Normal Data Row */
            <>
                {/* Row 2: [Alt/Dest] space [Speed/Type] */}
                <text 
                  x="5" 
                  y="14" 
                  fill={color} 
                  fontSize="14" 
                  fontFamily="monospace"
                  style={{ letterSpacing: '1px' }}
                >
                  <tspan>{leftField}</tspan>
                  <tspan x="45">{rightField}</tspan>
                </text>
                
                {/* Optional: Vertical Rate Indicator if climbing/descending */}
                {Math.abs(targetAltitude - altitude) > 0.5 && (
                     <text x="80" y="0" fill={color} fontSize="10">
                         {targetAltitude > altitude ? '↑' : '↓'}
                     </text>
                )}
            </>
        )}

      </g>
    </g>
  );
};

export default DataBlock;
