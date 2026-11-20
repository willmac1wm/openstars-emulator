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
  getCloudSttRuntime,
  isCloudSttAvailable,
  probeCloudStt,
  startCloudSttCapture,
  stopCloudSttAndTranscribe,
  subscribeCloudStt,
  CloudSttRuntime,
} from '../services/cloudStt';
import {
  mapMicError,
  STT_STILL_TRANSCRIBING,
  WHISPER_HEARD_NOTHING,
  WHISPER_TRANSCRIBE_FAILED,
} from '../services/voiceErrors';

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
  const [hearingVoice, setHearingVoice] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const desktop = isDesktopApp();
  const [supported] = useState(() => desktop || isSpeechRecognitionSupported());
  const [accurateSpeech, setAccurateSpeech] = useState(() => getVoiceSettings().accurateSpeech);
  const [cloudRt, setCloudRt] = useState<CloudSttRuntime>(getCloudSttRuntime);
  const handleRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(null);
  const callsignsRef = useRef(activeCallsigns);
  callsignsRef.current = activeCallsigns;
  const busyRef = useRef(false);
  const useCloudRef = useRef(false);
  /** Mirrors `holding` for callbacks (recognition onend fires after render). */
  const holdingRef = useRef(false);
  /** Mid-hold restarts of Web Speech before we give up on a dead mic. */
  const restartsRef = useRef(0);
  const MAX_HOLD_RESTARTS = 3;

  const setHoldingState = (next: boolean) => {
    holdingRef.current = next;
    setHolding(next);
  };

  useEffect(() => subscribeVoiceSettings(() => {
    setAccurateSpeech(getVoiceSettings().accurateSpeech);
  }), []);

  useEffect(() => subscribeCloudStt(setCloudRt), []);

  useEffect(() => {
    if (!desktop) void probeCloudStt();
  }, [desktop]);

  useEffect(() => {
    if (desktop) return undefined;
    handleRef.current = createSpeechRecognition({
      callsigns: callsignsRef.current,
      onSpeechStart: () => setHearingVoice(true),
      onPartial: (payload) => {
        setHearingVoice(true);
        onTranscript(payload);
      },
      onFinal: (payload) => onTranscript(payload),
      onError: (message) => reportError(message),
      onEnd: () => {
        setHearingVoice(false);
        if (!holdingRef.current) {
          setHolding(false);
          return;
        }
        // Chrome stops continuous recognition on its own (pause in speech,
        // no-speech timeout) while the button is still held — the mic used
        // to just go dead. Restart while held, up to a few times, then
        // tell the user instead of looping forever on a dead mic.
        if (restartsRef.current >= MAX_HOLD_RESTARTS) {
          restartsRef.current = 0;
          setHoldingState(false);
          onError?.('Mic stopped listening — release and hold PTT again.');
          return;
        }
        restartsRef.current += 1;
        window.setTimeout(() => {
          if (holdingRef.current) handleRef.current?.start();
        }, 50);
      },
    });
    return () => handleRef.current?.abort();
  }, [desktop, onError, onTranscript]);

  useEffect(() => {
    handleRef.current?.setCallsigns?.(activeCallsigns);
  }, [activeCallsigns]);

  const reportError = (msg: string) => {
    setLastError(msg);
    onError?.(msg);
  };

  const beginRef = useRef<() => void>(() => undefined);
  const endRef = useRef<() => void>(() => undefined);
  const stopTailTimerRef = useRef<number | null>(null);

  const begin = () => {
    setLastError(null);
    setHearingVoice(false);
    setMicLevel(0);
    if (stopTailTimerRef.current) {
      window.clearTimeout(stopTailTimerRef.current);
      stopTailTimerRef.current = null;
    }
    if (disabled || busyRef.current) {
      if (busyRef.current) reportError(STT_STILL_TRANSCRIBING);
      return;
    }
    if (desktop) {
      setHoldingState(true);
      restartsRef.current = 0;
      void startDesktopCapture().catch((err) => {
        setHoldingState(false);
        const message = mapMicError(err);
        if (message) reportError(message);
      });
      return;
    }
    const cloudOk = isCloudSttAvailable();
    useCloudRef.current = cloudOk;
    if (cloudOk) {
      setHoldingState(true);
      restartsRef.current = 0;
      void startCloudSttCapture((lvl) => {
        setMicLevel(lvl);
        if (lvl > 0.08) setHearingVoice(true);
      }).catch((err) => {
        useCloudRef.current = false;
        setHoldingState(false);
        const message = mapMicError(err);
        if (message) reportError(message);
      });
      return;
    }
    if (!supported) {
      reportError('Voice commands need Chrome or Edge (or Cloud STT key in Vercel). Use tap or type.');
      return;
    }
    setHoldingState(true);
    restartsRef.current = 0;
    handleRef.current?.setCallsigns?.(callsignsRef.current);
    handleRef.current?.start();
  };

  const end = () => {
    setMicLevel(0);
    if (desktop) {
      if (!holdingRef.current && !busyRef.current) return;
      setHoldingState(false);
      busyRef.current = true;
      setTranscribing(true);
      const prompt = buildAtcInitialPrompt(callsignsRef.current);
      void stopDesktopCaptureAndTranscribe(prompt)
        .then((payload) => {
          if (payload) {
            if (!payload.transcript.trim()) reportError(WHISPER_HEARD_NOTHING);
            else onTranscript(payload);
          } else {
            reportError(WHISPER_TRANSCRIBE_FAILED);
          }
        })
        .catch(() => reportError('Desktop speech failed — try again, or use tap/type.'))
        .finally(() => {
          busyRef.current = false;
          setTranscribing(false);
        });
      return;
    }
    if (useCloudRef.current) {
      setHoldingState(false);
      busyRef.current = true;
      setTranscribing(true);
      useCloudRef.current = false;
      void stopCloudSttAndTranscribe(callsignsRef.current)
        .then((payload) => {
          if (payload) {
            if (!payload.transcript.trim()) reportError(WHISPER_HEARD_NOTHING);
            else onTranscript(payload);
            return;
          }
          reportError(getCloudSttRuntime().error || WHISPER_TRANSCRIBE_FAILED);
        })
        .finally(() => {
          busyRef.current = false;
          setTranscribing(false);
        });
      return;
    }
    setHoldingState(false);
    // Keep Chrome's Web Speech stream open for a brief 350ms squelch tail on
    // release so the final word ("360") flushes instead of getting clipped.
    if (stopTailTimerRef.current) window.clearTimeout(stopTailTimerRef.current);
    stopTailTimerRef.current = window.setTimeout(() => {
      stopTailTimerRef.current = null;
      handleRef.current?.stop();
    }, 350);
  };

  beginRef.current = begin;
  endRef.current = end;

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      beginRef.current();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      endRef.current();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const sttHint = (() => {
    if (desktop) return 'Desktop Whisper · or hold SPACEBAR';
    if (cloudRt.available && cloudRt.provider) {
      return `Fast ATC Speech (${cloudRt.provider.toUpperCase()}) · or hold SPACEBAR`;
    }
    if (!supported) return 'mic unavailable — use tap / type';
    return 'Browser Mic · or hold SPACEBAR';
  })();

  void accurateSpeech;

  return (
    <div className="w-full flex flex-col gap-1">
      <button
        type="button"
        data-testid="ptt-button"
        disabled={disabled}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          begin();
        }}
        onPointerUp={() => {
          if (holdingRef.current) end();
        }}
        onPointerCancel={() => {
          if (holdingRef.current) end();
        }}
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
          {holding
            ? (hearingVoice ? 'HEARING VOICE…' : 'LISTENING…')
            : transcribing
              ? 'TRANSCRIBING…'
              : 'HOLD TO TALK'}
        </span>
        {holding && micLevel > 0 && (
          <div className="w-3/4 h-1 bg-black/40 rounded overflow-hidden mt-0.5">
            <div
              className="h-full bg-green-400 transition-all duration-75"
              style={{ width: `${Math.round(micLevel * 100)}%` }}
            />
          </div>
        )}
        {!compact && (
          <span className="text-[11px] font-normal opacity-80">{sttHint}</span>
        )}
      </button>
      {lastError && (
        <div
          data-testid="ptt-error"
          className="text-[10px] text-center text-amber-300 bg-amber-950/50 border border-amber-800/60 rounded px-2 py-0.5 font-mono"
          aria-live="polite"
        >
          {lastError}
        </div>
      )}
      {cloudRt.available && !desktop && (
        <div
          data-testid="accurate-speech-status"
          className="text-[10px] text-center text-green-300/80 font-mono"
          aria-live="polite"
        >
          Cloud ATC Speech ({cloudRt.provider?.toUpperCase()}){cloudRt.lastLatencyMs ? ` · ${cloudRt.lastLatencyMs}ms` : ''}
        </div>
      )}
    </div>
  );
};

export default PushToTalk;
