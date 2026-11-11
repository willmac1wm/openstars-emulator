import React, { useEffect, useState } from 'react';
import { Play, Sparkles } from 'lucide-react';
import VoicePreloadBanner from './VoicePreloadBanner';
import { getVoiceRuntime, subscribeVoiceRuntime, VoiceRuntime } from '../services/pilotVoice';

interface AttractModeProps {
  onStart: () => void;
  onTutorial?: () => void;
}

const LINES = [
  'Pilots get flight sims. Controllers get the radio.',
  'Hold the mic. Clear the traffic. Hear the readback.',
  'Keep them apart. Hit the gate. Beat the clock.',
];

const AttractMode: React.FC<AttractModeProps> = ({ onStart, onTutorial }) => {
  const [line, setLine] = useState(0);
  const [voice, setVoice] = useState<VoiceRuntime>(getVoiceRuntime);

  useEffect(() => {
    const timer = setInterval(() => setLine((n) => (n + 1) % LINES.length), 2800);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => subscribeVoiceRuntime(() => setVoice(getVoiceRuntime())), []);

  useEffect(() => {
    const start = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return;
      onStart();
    };
    window.addEventListener('keydown', start);
    return () => window.removeEventListener('keydown', start);
  }, [onStart]);

  const loading = voice.phase === 'loading';

  return (
    <div
      data-testid="attract-mode"
      className="absolute inset-0 z-[60] bg-black text-left w-full"
    >
      <button
        type="button"
        data-testid="attract-start"
        onClick={onStart}
        className="absolute inset-0 w-full h-full cursor-pointer"
        aria-label="Start arcade"
      />
      <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
        background: 'radial-gradient(circle at 30% 40%, rgba(20,241,149,0.25), transparent 45%), radial-gradient(circle at 70% 60%, rgba(59,130,246,0.2), transparent 40%)',
      }} />
      <div className="relative h-full flex flex-col items-center justify-center gap-6 p-6 text-center pointer-events-none">
        <div className="text-green-500/80 text-xs tracking-[0.4em] uppercase">OpenSTARS Expo</div>
        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tighter">
          OPEN<span className="text-green-500">STARS</span>
        </h1>
        <div className="text-gray-300 text-lg md:text-2xl min-h-[3rem] max-w-2xl" aria-live="polite">
          {LINES[line]}
        </div>
        <div
          className="w-full max-w-md pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <VoicePreloadBanner compact showBasicOption={loading} />
        </div>
        <div className="pointer-events-auto flex flex-col sm:flex-row gap-3 items-stretch w-full max-w-xl">
          <button
            type="button"
            data-testid="attract-arcade"
            onClick={onStart}
            className="flex-1 px-6 py-5 rounded-xl bg-green-500 text-black font-bold text-lg md:text-2xl shadow-[0_0_40px_rgba(20,241,149,0.45)] flex flex-col items-center gap-1"
          >
            <span className="flex items-center gap-3"><Play fill="black" /> Be a controller</span>
            {loading && (
              <span className="text-sm font-normal opacity-80">Voices still loading — start anyway?</span>
            )}
          </button>
          {onTutorial && (
            <button
              type="button"
              data-testid="attract-how-to-play"
              onClick={onTutorial}
              className="flex-1 px-6 py-5 rounded-xl border-2 border-cyan-500 bg-cyan-950/60 text-cyan-100 font-bold text-lg md:text-xl flex flex-col items-center gap-1"
            >
              <span className="flex items-center gap-2"><Sparkles size={22} /> How to play</span>
              <span className="text-xs font-normal opacity-80">Narrated · dial · Issue</span>
            </button>
          )}
        </div>
        <div className="text-gray-600 text-xs md:text-sm">Any key starts a 5-minute arcade shift</div>
      </div>
    </div>
  );
};

export default AttractMode;
