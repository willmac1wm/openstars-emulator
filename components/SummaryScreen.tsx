
import React from 'react';
import { RotateCcw, Share2, AlertTriangle, CheckCircle } from 'lucide-react';
import { GameStats, Incident } from '../types';

interface SummaryScreenProps {
  score: number;
  stats: GameStats;
  onReset: () => void;
}

const SummaryScreen: React.FC<SummaryScreenProps> = ({ score, stats, onReset }) => {
  
  // Calculate Grade
  let grade = 'F';
  let gradeColor = 'text-red-600';
  
  if (score > 8000) { grade = 'S'; gradeColor = 'text-yellow-400'; }
  else if (score > 6000) { grade = 'A'; gradeColor = 'text-green-500'; }
  else if (score > 4000) { grade = 'B'; gradeColor = 'text-cyan-500'; }
  else if (score > 2000) { grade = 'C'; gradeColor = 'text-orange-400'; }

  // Format duration
  const durationSec = Math.floor((Date.now() - stats.startTime) / 1000);
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;

  return (
    <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center text-green-500 font-mono p-4 animate-in fade-in duration-500">
      <div className="w-full max-w-3xl bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-2xl flex flex-col md:flex-row">
        
        {/* Left: Score Card */}
        <div className="p-8 bg-black border-r border-gray-800 flex flex-col items-center justify-center md:w-1/3 text-center">
            <div className="text-gray-500 text-sm tracking-widest uppercase mb-2">Final Score</div>
            <div className="text-5xl font-bold text-white mb-4">{score}</div>
            
            <div className="text-gray-600 text-xs uppercase tracking-widest mb-1">Performance Rating</div>
            <div className={`text-8xl font-black ${gradeColor} drop-shadow-lg`}>{grade}</div>
            
            <div className="mt-6 text-gray-500 text-xs">Duration: {mins}m {secs}s</div>
        </div>

        {/* Right: Details */}
        <div className="p-6 md:w-2/3 flex flex-col">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                AFTER ACTION REPORT
            </h2>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                    <div className="text-xs text-gray-400 uppercase">Clean Exits</div>
                    <div className="text-2xl font-bold text-green-400 flex items-center gap-2">
                        {stats.perfectExits} <CheckCircle size={16}/>
                    </div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                    <div className="text-xs text-gray-400 uppercase">Separation Busts</div>
                    <div className="text-2xl font-bold text-red-500 flex items-center gap-2">
                        {stats.separationBusts} <AlertTriangle size={16}/>
                    </div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                    <div className="text-xs text-gray-400 uppercase">Sloppy Exits</div>
                    <div className="text-xl font-bold text-yellow-500">{stats.sloppyExits}</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded border border-gray-700">
                    <div className="text-xs text-gray-400 uppercase">Procedure Errors</div>
                    <div className="text-xl font-bold text-orange-500">{stats.wrongAlt + stats.wrongGate}</div>
                </div>
            </div>

            {/* Incident Log (Replay) */}
            <div className="flex-1 bg-black rounded border border-gray-800 p-2 overflow-y-auto max-h-40 mb-4 text-xs space-y-1">
                <div className="text-gray-500 font-bold sticky top-0 bg-black pb-1 border-b border-gray-800">INCIDENT LOG</div>
                {stats.incidents.length === 0 ? (
                    <div className="text-gray-600 italic py-2 text-center">No Safety Incidents Reported. Good Job.</div>
                ) : (
                    stats.incidents.map((inc, idx) => (
                        <div key={idx} className="flex gap-2 text-red-400">
                            <span className="text-gray-600">[{inc.time}]</span>
                            <span>{inc.description} ({inc.involved.join(', ')})</span>
                        </div>
                    ))
                )}
            </div>

            <div className="flex gap-2 mt-auto">
                <button 
                    onClick={onReset}
                    className="flex-1 bg-green-700 hover:bg-green-600 text-white py-3 rounded font-bold flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                    <RotateCcw size={18} /> Return to Menu
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryScreen;
