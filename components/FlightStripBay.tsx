
import React from 'react';
import { Aircraft } from '../types';
import { ALTS_NORTH_EAST, ALTS_SOUTH_WEST } from '../constants';
import { Plane, AlertTriangle } from 'lucide-react';

interface FlightStripBayProps {
  aircraft: Aircraft[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}

const FlightStripBay: React.FC<FlightStripBayProps> = ({ aircraft, onSelect, selectedId }) => {
  // Sort: Active first, then by ID
  const sorted = [...aircraft].sort((a, b) => {
    // Prioritize Alerts
    if (a.alertLevel > 0 && b.alertLevel === 0) return -1;
    if (b.alertLevel > 0 && a.alertLevel === 0) return 1;
    // Then Active status
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
    return a.callsign.localeCompare(b.callsign);
  });

  return (
    <div className="w-64 bg-[#0a0a0a] border-r border-gray-800 flex flex-col h-full shrink-0">
      <div className="bg-gray-900 p-3 text-xs text-gray-400 font-bold uppercase tracking-wider border-b border-gray-800 flex justify-between items-center">
        <span>Flight Strips</span>
        <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-500">{aircraft.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {sorted.length === 0 && (
            <div className="text-gray-600 text-center text-xs italic mt-10">No Aircraft</div>
        )}
        {sorted.map(ac => {
          const isEven = ['SOU', 'WES'].includes(ac.destination);
          const validAlts = isEven ? ALTS_SOUTH_WEST : ALTS_NORTH_EAST;
          const isSelected = ac.id === selectedId;
          
          // Strip Color Logic
          let stripBorder = "border-l-4 border-gray-600"; // Inbound/Default
          let bg = "bg-gray-900";
          let text = "text-gray-400";
          
          if (ac.status === 'CRASH' || ac.status === 'SEPARATION_LOSS') {
              stripBorder = "border-l-4 border-red-600";
              bg = "bg-red-900/10";
              text = "text-red-400";
          } else if (ac.alertLevel > 0) {
              stripBorder = "border-l-4 border-yellow-500";
              text = "text-yellow-400";
          } else if (ac.status === 'HANDOFF') {
              stripBorder = "border-l-4 border-green-600";
              text = "text-green-600";
          } else if (ac.status === 'ACTIVE') {
              stripBorder = "border-l-4 border-cyan-500";
              text = "text-cyan-400";
          }
          
          if (isSelected) {
              bg = "bg-gray-800 ring-1 ring-white/20"; 
          }

          return (
            <div 
                key={ac.id}
                onClick={() => onSelect(ac.id)}
                className={`${bg} ${stripBorder} p-2 shadow-sm cursor-pointer hover:bg-gray-800 transition-all font-mono text-xs relative`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-lg font-bold ${text}`}>{ac.callsign}</span>
                {ac.alertLevel > 0 && <AlertTriangle size={12} className="text-yellow-500 animate-pulse"/>}
              </div>
              
              <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1">
                  <span>{ac.type}</span>
                  <span>{ac.status}</span>
              </div>

              <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-300">
                <div className="bg-black/40 p-1 rounded text-center">
                    <div className="text-gray-600 text-[9px]">EXIT</div>
                    <div className="font-bold">{ac.destination}</div>
                </div>
                <div className="bg-black/40 p-1 rounded text-center">
                    <div className="text-gray-600 text-[9px]">ALT</div>
                    <div className={validAlts.includes(Math.round(ac.altitude)) ? "text-green-500" : "text-white"}>
                        {Math.floor(ac.altitude)}
                    </div>
                </div>
                <div className="bg-black/40 p-1 rounded text-center">
                    <div className="text-gray-600 text-[9px]">SPD</div>
                    <div>{Math.floor(ac.speed)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FlightStripBay;
