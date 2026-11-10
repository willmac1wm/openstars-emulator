import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import VoicePreloadBanner from './VoicePreloadBanner';
import { getVoiceRuntime, subscribeVoiceRuntime, VoiceRuntime } from '../services/pilotVoice';

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
  const [voice, setVoice] = useState<VoiceRuntime>(getVoiceRuntime);

  useEffect(() => {
    const timer = setInterval(() => setLine((n) => (n + 1) % LINES.length), 2800);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => subscribeVoiceRuntime(() => setVoice(getVoiceRuntime())), []);

  useEffect(() => {
    const start = () => onStart();
    window.addEventListener('keydown', start);
    return () => window.removeEventListener('keydown', start);
  }, [onStart]);

  const loading = voice.phase === 'loading';

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
        <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <VoicePreloadBanner compact showBasicOption={loading} />
        </div>
        <div className="mt-2 px-8 py-5 rounded-xl bg-green-500 text-black font-bold text-xl md:text-3xl shadow-[0_0_40px_rgba(20,241,149,0.45)] flex flex-col items-center gap-2 animate-in zoom-in">
          <span className="flex items-center gap-3"><Play fill="black" /> Press to be an Air Traffic Controller</span>
          {loading && (
            <span className="text-sm font-normal opacity-80">Voices still loading — start anyway?</span>
          )}
        </div>
        <div className="text-gray-600 text-xs md:text-sm">Any key or tap starts a 3-minute arcade shift</div>
      </div>
    </button>
  );
};

export default AttractMode;
