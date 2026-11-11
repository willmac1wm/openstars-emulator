import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { createSpeechRecognition, isSpeechRecognitionSupported, SpeechResultPayload } from '../services/speechRecognition';
import { isDesktopApp } from '../services/desktop';
import {
  buildAtcInitialPrompt,
  startDesktopCapture,
  stopDesktopCaptureAndTranscribe,
} from '../services/desktopStt';

interface PushToTalkProps {
  disabled?: boolean;
  /** Shorter control for classroom panel heights (1024×640). */
  compact?: boolean;
  onTranscript: (payload: SpeechResultPayload) => void;
  onError?: (message: string) => void;
  /** Live scope callsigns for Whisper initial_prompt biasing (desktop). */
  activeCallsigns?: string[];
}

const PushToTalk: React.FC<PushToTalkProps> = ({
  disabled,
  compact,
  onTranscript,
  onError,
  activeCallsigns = [],
}) => {
  const [holding, setHolding] = useState(false);
  const desktop = isDesktopApp();
  const [supported] = useState(() => desktop || isSpeechRecognitionSupported());
  const handleRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const callsignsRef = useRef(activeCallsigns);
  callsignsRef.current = activeCallsigns;
  const busyRef = useRef(false);

  useEffect(() => {
    if (desktop) return undefined;
    handleRef.current = createSpeechRecognition({
      onPartial: (payload) => onTranscript(payload),
      onFinal: (payload) => onTranscript(payload),
      onError: (message) => onError?.(message),
      onEnd: () => setHolding(false),
    });
    return () => handleRef.current?.abort();
  }, [desktop, onError, onTranscript]);

  const begin = () => {
    if (disabled || busyRef.current) return;
    if (desktop) {
      setHolding(true);
      void startDesktopCapture().catch((err) => {
        setHolding(false);
        onError?.(err instanceof Error ? err.message : 'Mic error');
      });
      return;
    }
    if (!supported) {
      onError?.('Voice commands need Chrome or Edge. Use the tap pad or type.');
      return;
    }
    setHolding(true);
    handleRef.current?.start();
  };

  const end = () => {
    if (desktop) {
      if (!holding && !busyRef.current) return;
      setHolding(false);
      busyRef.current = true;
      const prompt = buildAtcInitialPrompt(callsignsRef.current);
      void stopDesktopCaptureAndTranscribe(prompt)
        .then((payload) => {
          if (payload) onTranscript(payload);
        })
        .catch((err) => onError?.(err instanceof Error ? err.message : 'STT error'))
        .finally(() => {
          busyRef.current = false;
        });
      return;
    }
    setHolding(false);
    handleRef.current?.stop();
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      begin();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      end();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  return (
    <button
      type="button"
      data-testid="ptt-button"
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
        begin();
      }}
      onPointerUp={end}
      onPointerLeave={() => holding && end()}
      onContextMenu={(event) => event.preventDefault()}
      className={`w-full rounded-xl border-2 font-bold tracking-wide flex flex-col items-center justify-center select-none ${
        compact
          ? 'min-h-[40px] text-sm gap-0 py-1'
          : 'min-h-[72px] text-lg md:text-xl gap-1'
      } ${
        holding
          ? 'bg-red-600 border-red-300 text-white shadow-[0_0_30px_rgba(239,68,68,0.55)] scale-[1.02]'
          : 'bg-red-900/50 border-red-500 text-red-100 hover:bg-red-800/70'
      } disabled:opacity-40`}
      aria-pressed={holding}
    >
      <span className="flex items-center gap-2">
        {holding ? <Mic size={compact ? 16 : 22} /> : <MicOff size={compact ? 16 : 22} />}
        {holding ? 'LISTENING…' : 'HOLD TO TALK'}
      </span>
      {!compact && (
        <span className="text-[11px] font-normal opacity-80">
          {desktop
            ? 'Desktop Whisper · or hold SPACEBAR'
            : supported
              ? 'or hold SPACEBAR'
              : 'mic unavailable — use tap / type'}
        </span>
      )}
    </button>
  );
};

export default PushToTalk;
