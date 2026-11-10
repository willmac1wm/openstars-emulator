import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';

interface AttractModeProps {
  onStart: () => void;
}

const LINES = [
  'Pilots get flight sims. Controllers get the radio.',
  'Hold the mic. Clear the traffic. Hear the readback.',
  'Keep them apart. Hit the gate. Beat the clock.',
];

const AttractMode: React.FC<AttractModeProps> = ({ onStart }) => {
  const [line, setLine] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setLine((n) => (n + 1) % LINES.length), 2800);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const start = () => onStart();
    window.addEventListener('keydown', start);
    return () => window.removeEventListener('keydown', start);
  }, [onStart]);

  return (
    <button
      type="button"
      data-testid="attract-mode"
      onClick={onStart}
      className="absolute inset-0 z-[60] bg-black text-left w-full cursor-pointer"
    >
      <div className="absolute inset-0 opacity-40" style={{
        background: 'radial-gradient(circle at 30% 40%, rgba(20,241,149,0.25), transparent 45%), radial-gradient(circle at 70% 60%, rgba(59,130,246,0.2), transparent 40%)',
      }} />
      <div className="relative h-full flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="text-green-500/80 text-xs tracking-[0.4em] uppercase">OpenSTARS Expo</div>
        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tighter">
          OPEN<span className="text-green-500">STARS</span>
        </h1>
        <div className="text-gray-300 text-lg md:text-2xl min-h-[3rem] max-w-2xl" aria-live="polite">
          {LINES[line]}
        </div>
        <div className="mt-4 px-8 py-5 rounded-xl bg-green-500 text-black font-bold text-xl md:text-3xl shadow-[0_0_40px_rgba(20,241,149,0.45)] flex items-center gap-3 animate-in zoom-in">
          <Play fill="black" /> Press to be an Air Traffic Controller
        </div>
        <div className="text-gray-600 text-xs md:text-sm">Any key or tap starts a 3-minute arcade shift</div>
      </div>
    </button>
  );
};

export default AttractMode;
