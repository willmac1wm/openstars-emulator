import React from 'react';
import { PhoneCall } from 'lucide-react';
import PushToTalk from './PushToTalk';
import TapCommandPad from './TapCommandPad';
import { Aircraft } from '../types';
import type { SpeechResultPayload } from '../services/speechRecognition';

interface ExpoArcadeHUDProps {
  remainingMs: number;
  banner: string | null;
  liveTranscript: string;
  selected: Aircraft | null;
  onTranscript: (payload: SpeechResultPayload) => void;
  onSpeechError: (message: string) => void;
  onIssue: (command: string) => void;
  onFullscreen: () => void;
  /** Exit to menu — previously the only exit was an unlabeled icon, and the
   *  ControlPanel reset button was hidden entirely in Expo. */
  onExit?: () => void;
  /** Guided how-to-play — hide the arcade countdown. */
  tutorial?: boolean;
  /** Callsigns on scope for desktop Whisper prompt biasing. */
  activeCallsigns?: string[];
  /** Toggle visibility of the heading/altitude/speed dial pad. */
  showTapPad?: boolean;
  /** Endless Sector Saturation mode props. */
  saturation?: boolean;
  elapsedMs?: number;
  activeAircraftCount?: number;
  onCallForHelp?: () => void;
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
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
  onExit,
  tutorial = false,
  activeCallsigns = [],
  showTapPad = true,
  saturation = false,
  elapsedMs = 0,
  activeAircraftCount = 0,
  onCallForHelp,
}) => {
  return (
    <div
      className="w-full h-full min-h-0 flex flex-col gap-1.5"
      data-testid="expo-arcade-hud"
      data-tutorial={tutorial ? '1' : undefined}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <div
          className={`font-mono text-lg font-bold px-2 py-0 rounded border ${
            tutorial
              ? 'text-cyan-300 border-cyan-800'
              : saturation
                ? 'text-amber-300 border-amber-700'
                : remainingMs < 30000
                  ? 'text-red-400 border-red-700'
                  : 'text-green-300 border-green-800'
          }`}
        >
          {tutorial ? 'HOW TO PLAY' : saturation ? formatElapsed(elapsedMs) : formatClock(remainingMs)}
        </div>
        {saturation && (
          <div
            data-testid="saturation-count"
            className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-700/80 bg-red-950/50 text-red-200 whitespace-nowrap"
          >
            {activeAircraftCount} A/C
          </div>
        )}
        {banner && (
          <div className="flex-1 min-w-0 truncate bg-amber-500/20 border border-amber-400 text-amber-100 text-[10px] font-bold px-1.5 py-0.5 rounded">
            {banner}
          </div>
        )}
        <button
          type="button"
          onClick={onFullscreen}
          className="ml-auto shrink-0 text-[9px] uppercase tracking-wider border border-gray-700 text-gray-400 px-1.5 py-0.5 rounded hover:text-white"
        >
          Fullscreen
        </button>
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            aria-label="Exit to menu"
            title="Exit to menu"
            className="shrink-0 text-[9px] uppercase tracking-wider border border-red-800 text-red-300 px-1.5 py-0.5 rounded hover:bg-red-950/50"
          >
            Exit
          </button>
        )}
      </div>

      {saturation && onCallForHelp && (
        <button
          type="button"
          data-testid="call-for-help"
          onClick={onCallForHelp}
          className="shrink-0 w-full py-2 px-3 rounded border-2 border-red-500 bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(239,68,68,0.45)] transition-all"
        >
          <PhoneCall size={14} />
          CALL FOR HELP (REQUEST RELIEF)
        </button>
      )}

      <div className="shrink-0">
        <PushToTalk
          compact
          onTranscript={onTranscript}
          onError={onSpeechError}
          activeCallsigns={activeCallsigns}
        />
      </div>

      {/* Collapsed transcript — single line so Issue stays on-screen */}
      <div
        data-testid="live-transcript"
        className="shrink-0 h-7 overflow-hidden bg-black border border-cyan-900 rounded px-2 py-1 text-cyan-200 text-[11px] font-mono truncate"
        aria-live="polite"
        title={liveTranscript || undefined}
      >
        {liveTranscript || (tutorial ? 'Follow the Instructor box — Next / Replay / Skip' : 'Hold PTT and speak…')}
      </div>

      {showTapPad && <TapCommandPad aircraft={selected} onIssue={onIssue} />}
    </div>
  );
};

export default ExpoArcadeHUD;
