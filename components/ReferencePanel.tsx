
import React from 'react';
import { SIM_SPEED_OPTIONS } from '../constants';
import { Clock, Gauge, Map } from 'lucide-react';

interface ReferencePanelProps {
  timeScale: number;
  setTimeScale: (scale: number) => void;
}

const ReferencePanel: React.FC<ReferencePanelProps> = ({ timeScale, setTimeScale }) => {
  return (
    <div className="w-64 bg-[#0a0a0a] border-l border-gray-800 flex flex-col h-full shrink-0">
      
      {/* Sim Speed */}
      <div className="p-4 border-b border-gray-800">
         <div className="text-xs text-gray-500 font-bold uppercase mb-2 flex items-center gap-2">
            <Clock size={14}/> Sim Speed
         </div>
         <div className="grid grid-cols-4 gap-1">
            {SIM_SPEED_OPTIONS.map(s => (
                <button 
                    key={s} 
                    onClick={() => setTimeScale(s)} 
                    className={`text-xs py-2 rounded border transition-all font-bold ${
                        timeScale === s 
                        ? 'bg-green-900/50 border-green-500 text-white shadow-[0_0_10px_rgba(20,241,149,0.2)]' 
                        : 'bg-black border-gray-700 text-gray-500 hover:border-gray-500'
                    }`}
                >
                    {s}x
                </button>
            ))}
         </div>
      </div>

      {/* Altitude Rules */}
      <div className="p-4 border-b border-gray-800 flex-1">
         <div className="text-xs text-gray-500 font-bold uppercase mb-3 flex items-center gap-2">
            <Map size={14}/> Gate Rules
         </div>
         
         <div className="space-y-4">
             <div className="bg-gray-900/50 p-3 rounded border border-gray-800">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-green-400 font-bold">NORTH / EAST</span>
                    <span className="text-[10px] bg-gray-800 px-1 rounded text-gray-400">ODD</span>
                </div>
                <div className="text-2xl text-white font-mono tracking-widest">
                    070 <span className="text-gray-600">|</span> 090
                </div>
             </div>

             <div className="bg-gray-900/50 p-3 rounded border border-gray-800">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-green-400 font-bold">SOUTH / WEST</span>
                    <span className="text-[10px] bg-gray-800 px-1 rounded text-gray-400">EVEN</span>
                </div>
                <div className="text-2xl text-white font-mono tracking-widest">
                    060 <span className="text-gray-600">|</span> 080
                </div>
             </div>
         </div>
         
         <div className="mt-6 text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-400">REMINDER:</strong><br/>
            Aircraft must be at the correct altitude before crossing the gate boundary.
            Use <span className="text-green-500">A [alt]</span> to change altitude early.
         </div>
      </div>

      {/* System Stats */}
      <div className="p-4 bg-black">
          <div className="text-xs text-gray-500 font-bold uppercase mb-2 flex items-center gap-2">
            <Gauge size={14}/> System
         </div>
         <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="bg-gray-900 p-2 rounded border border-gray-800">
                <div className="text-gray-500">RANGE</div>
                <div className="text-green-400">40 NM</div>
            </div>
            <div className="bg-gray-900 p-2 rounded border border-gray-800">
                <div className="text-gray-500">ALTIMETER</div>
                <div className="text-green-400">29.92</div>
            </div>
         </div>
      </div>

    </div>
  );
};

export default ReferencePanel;
