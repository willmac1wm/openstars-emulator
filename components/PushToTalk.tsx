import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { createSpeechRecognition, isSpeechRecognitionSupported, SpeechResultPayload } from '../services/speechRecognition';
import { isDesktopApp } from '../services/desktop';
import {
  buildAtcInitialPrompt,
  startDesktopCapture,
  stopDesktopCaptureAndTranscribe,
} from '../services/desktopStt';
import { getVoiceSettings, subscribeVoiceSettings } from '../services/voiceSettings';
import {
  ensureWebWhisperLoading,
  getWebWhisperRuntime,
  isWebWhisperReady,
  startWebWhisperCapture,
  stopWebWhisperAndTranscribe,
  subscribeWebWhisper,
  WebWhisperRuntime,
} from '../services/webWhisper';

interface PushToTalkProps {
  disabled?: boolean;
  /** Shorter control for classroom panel heights (1024×640). */
  compact?: boolean;
  onTranscript: (payload: SpeechResultPayload) => void;
  onError?: (message: string) => void;
  /** Live scope callsigns for Whisper / SpeechGrammar bias. */
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
  const [accurateSpeech, setAccurateSpeech] = useState(() => getVoiceSettings().accurateSpeech);
  const [whisperRt, setWhisperRt] = useState<WebWhisperRuntime>(getWebWhisperRuntime);
  const handleRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const callsignsRef = useRef(activeCallsigns);
  callsignsRef.current = activeCallsigns;
  const busyRef = useRef(false);
  const useWhisperRef = useRef(false);

  useEffect(() => subscribeVoiceSettings(() => {
    const next = getVoiceSettings().accurateSpeech;
    setAccurateSpeech(next);
    if (next && !desktop) ensureWebWhisperLoading();
  }), [desktop]);

  useEffect(() => subscribeWebWhisper(setWhisperRt), []);

  useEffect(() => {
    if (accurateSpeech && !desktop) ensureWebWhisperLoading();
  }, [accurateSpeech, desktop]);

  useEffect(() => {
    if (desktop) return undefined;
    handleRef.current = createSpeechRecognition({
      callsigns: callsignsRef.current,
      onPartial: (payload) => onTranscript(payload),
      onFinal: (payload) => onTranscript(payload),
      onError: (message) => onError?.(message),
      onEnd: () => setHolding(false),
    });
    return () => handleRef.current?.abort();
  }, [desktop, onError, onTranscript]);

  useEffect(() => {
    handleRef.current?.setCallsigns?.(activeCallsigns);
  }, [activeCallsigns]);

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
    const whisperOk = accurateSpeech && isWebWhisperReady();
    useWhisperRef.current = whisperOk;
    if (whisperOk) {
      setHolding(true);
      void startWebWhisperCapture().catch((err) => {
        useWhisperRef.current = false;
        setHolding(false);
        // Silent path: fall through to Web Speech on next press; surface only hard mic errors.
        onError?.(err instanceof Error ? err.message : 'Mic error');
      });
      return;
    }
    if (!supported) {
      onError?.('Voice commands need Chrome or Edge. Use the tap pad or type.');
      return;
    }
    setHolding(true);
    handleRef.current?.setCallsigns?.(callsignsRef.current);
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
    if (useWhisperRef.current) {
      setHolding(false);
      busyRef.current = true;
      useWhisperRef.current = false;
      void stopWebWhisperAndTranscribe(callsignsRef.current)
        .then((payload) => {
          if (payload) {
            onTranscript(payload);
            return;
          }
          // Whisper failed / too slow — fall back once via Web Speech (user must re-PTT).
        })
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

  const sttHint = (() => {
    if (desktop) return 'Desktop Whisper · or hold SPACEBAR';
    if (!supported && !accurateSpeech) return 'mic unavailable — use tap / type';
    if (!accurateSpeech) return 'or hold SPACEBAR';
    if (whisperRt.phase === 'ready') return 'Accurate STT ready · SPACEBAR';
    if (whisperRt.phase === 'loading') return `Accurate STT ${Math.round(whisperRt.progress * 100)}%…`;
    if (whisperRt.phase === 'unsupported') return 'Accurate STT needs WebGPU · using browser mic';
    if (whisperRt.phase === 'error') return 'Accurate STT unavailable · using browser mic';
    return 'Accurate STT warming…';
  })();

  return (
    <div className="w-full flex flex-col gap-1">
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
          <span className="text-[11px] font-normal opacity-80">{sttHint}</span>
        )}
      </button>
      {accurateSpeech && !desktop && (
        <div
          data-testid="accurate-speech-status"
          data-phase={whisperRt.phase}
          className="text-[10px] text-center text-violet-300/90 font-mono"
          aria-live="polite"
        >
          {whisperRt.phase === 'ready'
            ? `Accurate speech ready${whisperRt.lastLatencyMs ? ` · last ${whisperRt.lastLatencyMs}ms` : ''}`
            : whisperRt.phase === 'loading'
              ? `Downloading Whisper tiny.en… ${Math.round(whisperRt.progress * 100)}%`
              : whisperRt.phase === 'unsupported'
                ? 'Accurate speech needs WebGPU — using browser speech'
                : whisperRt.phase === 'error'
                  ? 'Accurate speech unavailable — using browser speech'
                  : 'Accurate speech (beta)'}
        </div>
      )}
    </div>
  );
};

export default PushToTalk;
