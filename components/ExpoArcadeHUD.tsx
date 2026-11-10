import React from 'react';
import PushToTalk from './PushToTalk';
import TapCommandPad from './TapCommandPad';
import { Aircraft } from '../types';

interface ExpoArcadeHUDProps {
  remainingMs: number;
  banner: string | null;
  liveTranscript: string;
  selected: Aircraft | null;
  onTranscript: (text: string, isFinal: boolean) => void;
  onSpeechError: (message: string) => void;
  onIssue: (command: string) => void;
  onFullscreen: () => void;
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const ExpoArcadeHUD: React.FC<ExpoArcadeHUDProps> = ({
  remainingMs,
  banner,
  liveTranscript,
  selected,
  onTranscript,
  onSpeechError,
  onIssue,
  onFullscreen,
}) => {
  return (
    <div className="w-full space-y-2" data-testid="expo-arcade-hud">
      <div className="flex items-center gap-2">
        <div className={`font-mono text-2xl font-bold px-3 py-1 rounded border ${remainingMs < 30000 ? 'text-red-400 border-red-700' : 'text-green-300 border-green-800'}`}>
          {formatClock(remainingMs)}
        </div>
        <button
          type="button"
          onClick={onFullscreen}
          className="ml-auto text-[10px] uppercase tracking-wider border border-gray-700 text-gray-400 px-2 py-1 rounded hover:text-white"
        >
          Fullscreen
        </button>
      </div>

      {banner && (
        <div className="bg-amber-500/20 border border-amber-400 text-amber-100 text-sm font-bold px-3 py-2 rounded animate-in fade-in">
          {banner}
        </div>
      )}

      <PushToTalk onTranscript={onTranscript} onError={onSpeechError} />

      <div
        data-testid="live-transcript"
        className="min-h-[3rem] bg-black border border-cyan-900 rounded px-3 py-2 text-cyan-200 text-sm font-mono"
        aria-live="polite"
      >
        {liveTranscript || 'Hold PTT and speak a clearance…'}
      </div>

      <TapCommandPad aircraft={selected} onIssue={onIssue} />
    </div>
  );
};

export default ExpoArcadeHUD;
