import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { createSpeechRecognition, isSpeechRecognitionSupported } from '../services/speechRecognition';

interface PushToTalkProps {
  disabled?: boolean;
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
}

const PushToTalk: React.FC<PushToTalkProps> = ({ disabled, onTranscript, onError }) => {
  const [holding, setHolding] = useState(false);
  const [supported] = useState(() => isSpeechRecognitionSupported());
  const handleRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);

  useEffect(() => {
    handleRef.current = createSpeechRecognition({
      onPartial: (text) => onTranscript(text, false),
      onFinal: (text) => onTranscript(text, true),
      onError: (message) => onError?.(message),
      onEnd: () => setHolding(false),
    });
    return () => handleRef.current?.abort();
  }, [onError, onTranscript]);

  const begin = () => {
    if (disabled) return;
    if (!supported) {
      onError?.('Voice commands need Chrome or Edge. Use the tap pad or type.');
      return;
    }
    setHolding(true);
    handleRef.current?.start();
  };

  const end = () => {
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
      className={`w-full min-h-[72px] rounded-xl border-2 font-bold text-lg md:text-xl tracking-wide flex flex-col items-center justify-center gap-1 select-none ${
        holding
          ? 'bg-red-600 border-red-300 text-white shadow-[0_0_30px_rgba(239,68,68,0.55)] scale-[1.02]'
          : 'bg-red-900/50 border-red-500 text-red-100 hover:bg-red-800/70'
      } disabled:opacity-40`}
      aria-pressed={holding}
    >
      <span className="flex items-center gap-2">
        {holding ? <Mic size={22} /> : <MicOff size={22} />}
        {holding ? 'LISTENING…' : 'HOLD TO TALK'}
      </span>
      <span className="text-[11px] font-normal opacity-80">
        {supported ? 'or hold SPACEBAR' : 'mic unavailable — use tap / type'}
      </span>
    </button>
  );
};

export default PushToTalk;
