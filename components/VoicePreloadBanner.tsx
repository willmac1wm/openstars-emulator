import React, { useEffect, useState } from 'react';
import {
  getVoiceRuntime,
  KOKORO_APPROX_BYTES,
  subscribeVoiceRuntime,
  useBasicVoiceNow,
  voiceStatusLabel,
  VoiceRuntime,
} from '../services/pilotVoice';
import { getVoiceSettings, subscribeVoiceSettings, updateVoiceSettings, VoiceSettings } from '../services/voiceSettings';

interface Props {
  /** Show the teacher escape hatch to force Web Speech. */
  showBasicOption?: boolean;
  className?: string;
  compact?: boolean;
}

const VoicePreloadBanner: React.FC<Props> = ({ showBasicOption = true, className = '', compact = false }) => {
  const [runtime, setRuntime] = useState<VoiceRuntime>(getVoiceRuntime);
  const [settings, setSettings] = useState<VoiceSettings>(getVoiceSettings);

  useEffect(() => subscribeVoiceRuntime(() => setRuntime(getVoiceRuntime())), []);
  useEffect(() => subscribeVoiceSettings(() => setSettings(getVoiceSettings())), []);

  const pct = Math.round(runtime.progress * 100);
  const loading = runtime.phase === 'loading';
  const ready = runtime.phase === 'ready';
  const basic = runtime.phase === 'fallback';
  const fast = ready && !settings.naturalVoices;

  return (
    <div
      data-testid="voice-preload-banner"
      data-phase={runtime.phase}
      data-cached={runtime.fromCache ? 'true' : 'false'}
      data-fast={fast ? 'true' : 'false'}
      className={`rounded border px-3 py-2 space-y-1.5 ${
        ready
          ? 'border-green-700/60 bg-green-950/40 text-green-300'
          : basic
            ? 'border-amber-700/50 bg-amber-950/30 text-amber-200'
            : 'border-cyan-800/50 bg-cyan-950/30 text-cyan-200'
      } ${className}`}
      aria-live="polite"
    >
      <div className={`font-mono ${compact ? 'text-[11px]' : 'text-xs md:text-sm'}`}>
        {voiceStatusLabel(runtime)}
        {loading && (
          <span className="text-gray-500 ml-2" data-testid="voice-preload-mb">
            ~{Math.max(1, Math.round((runtime.progress * KOKORO_APPROX_BYTES) / 1_000_000))}/
            {Math.round(KOKORO_APPROX_BYTES / 1_000_000)} MB
          </span>
        )}
        {ready && runtime.loadMs > 0 && (
          <span className="text-gray-500 ml-2">({(runtime.loadMs / 1000).toFixed(1)}s{runtime.fromCache ? ' · cache' : ''})</span>
        )}
        {ready && runtime.lastGenerateMs > 0 && settings.naturalVoices && (
          <span className="text-gray-500 ml-2">· synth {runtime.lastGenerateMs}ms</span>
        )}
      </div>
      {loading && (
        <div className="h-2 w-full bg-black/60 rounded overflow-hidden border border-gray-800">
          <div
            data-testid="voice-preload-bar"
            className="h-full bg-cyan-400 transition-[width] duration-200"
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
      )}
      {!compact && (
        <div className="text-[10px] md:text-xs text-gray-500 leading-snug">
          Readbacks use <strong className="text-gray-400 font-semibold">Fast voice</strong> by default.
          Natural voices (~92 MB) load in the background from this site and stay cached for next visit.
          The guided tutorial switches to natural voice automatically once ready.
        </div>
      )}
      {showBasicOption && loading && (
        <button
          type="button"
          data-testid="use-basic-voice"
          onClick={(event) => {
            event.stopPropagation();
            useBasicVoiceNow();
          }}
          className="text-[10px] md:text-xs underline text-amber-300/90 hover:text-amber-200"
        >
          Start with basic voice
        </button>
      )}
      {showBasicOption && ready && !settings.naturalVoices && !compact && (
        <button
          type="button"
          data-testid="enable-natural-voices"
          onClick={(event) => {
            event.stopPropagation();
            updateVoiceSettings({ naturalVoices: true });
          }}
          className="text-[10px] md:text-xs underline text-violet-300/90 hover:text-violet-200"
        >
          {runtime.neuralFastEnough ? 'Enable natural voices (GPU ready)' : 'Natural voices (slower)'}
        </button>
      )}
    </div>
  );
};

export default VoicePreloadBanner;
