import React, { useEffect, useState } from 'react';
import { Gauge, Map, Share2, Check } from 'lucide-react';

interface ReferencePanelProps {
  scenarioSeed?: string | null;
  scenarioName?: string | null;
}

const ReferencePanel: React.FC<ReferencePanelProps> = ({
  scenarioSeed = null,
  scenarioName = null,
}) => {
  const [zuluTime, setZuluTime] = useState(() => new Date());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setZuluTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="w-64 bg-[#0a0a0a] border-l border-gray-800 flex flex-col h-full shrink-0">
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

      {/* System Stats: Range, Altimeter, Zulu Clock, Scenario Seed */}
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
            <div className="bg-gray-900 p-2 rounded border border-gray-800 col-span-2 flex items-center justify-between">
                <span className="text-gray-500">ZULU TIME</span>
                <span data-testid="system-zulu-clock" className="text-green-400 font-bold text-xs">
                  {zuluTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC', hour12: false })}Z
                </span>
            </div>
            {scenarioSeed && (
              <div className="bg-gray-900 p-2 rounded border border-gray-800 col-span-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-gray-500">{scenarioName ? scenarioName.toUpperCase() : 'SCENARIO'}</div>
                  <div data-testid="active-seed" className="text-green-300 font-bold truncate">
                    {scenarioSeed}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleShare}
                  title="Copy scenario link"
                  aria-label="Copy scenario link"
                  className="shrink-0 bg-gray-800 hover:bg-gray-700 p-1.5 rounded border border-gray-700 text-gray-300"
                >
                  {copied ? <Check size={12} className="text-green-400" /> : <Share2 size={12} />}
                </button>
              </div>
            )}
         </div>
      </div>

    </div>
  );
};

export default ReferencePanel;
