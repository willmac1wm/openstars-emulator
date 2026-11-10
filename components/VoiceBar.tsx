import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { getVoiceSettings, subscribeVoiceSettings, updateVoiceSettings, VoiceSettings } from '../services/voiceSettings';
import { getVoiceRuntime, primePilotVoice, subscribeVoiceRuntime, VoiceRuntime } from '../services/pilotVoice';

const VoiceBar: React.FC = () => {
  const [settings, setSettings] = useState<VoiceSettings>(getVoiceSettings);
  const [runtime, setRuntime] = useState<VoiceRuntime>(getVoiceRuntime);

  useEffect(() => subscribeVoiceSettings(() => setSettings(getVoiceSettings())), []);
  useEffect(() => subscribeVoiceRuntime(() => setRuntime(getVoiceRuntime())), []);

  const engine = !settings.enabled
    ? 'off'
    : runtime.engine === 'kokoro'
      ? 'kokoro'
      : runtime.engine === 'webspeech'
        ? 'webspeech'
        : runtime.phase === 'loading'
          ? 'loading'
          : 'idle';

  const statusLabel = engine === 'off'
    ? 'VOICE OFF'
    : engine === 'loading'
      ? `LOADING ${Math.round(runtime.progress * 100)}%`
      : engine === 'kokoro'
        ? 'NEURAL'
        : engine === 'webspeech'
          ? 'BROWSER'
          : 'VOICE ON';

  return (
    <div className="flex items-center gap-1 text-[10px] text-gray-400" aria-label="Pilot voice">
      <button
        type="button"
        aria-pressed={settings.enabled}
        onClick={() => {
          const next = !settings.enabled;
          updateVoiceSettings({ enabled: next });
          if (next) primePilotVoice();
        }}
        className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${
          settings.enabled
            ? 'border-green-600 text-green-300 bg-green-900/40'
            : 'border-gray-700 text-gray-500'
        }`}
      >
        {settings.enabled ? <Volume2 size={10} /> : <VolumeX size={10} />}
        VOX
      </button>
      <label className="flex items-center gap-1">
        <span className="sr-only">Voice volume</span>
        <input
          aria-label="Voice volume"
          type="range"
          min={0}
          max={100}
          value={Math.round(settings.volume * 100)}
          onChange={(event) => updateVoiceSettings({ volume: Number(event.target.value) / 100 })}
          className="w-12 accent-green-500"
        />
      </label>
      <button
        type="button"
        aria-pressed={settings.radioEffect}
        onClick={() => updateVoiceSettings({ radioEffect: !settings.radioEffect })}
        className={`px-1.5 py-0.5 rounded border ${
          settings.radioEffect ? 'border-amber-600 text-amber-200' : 'border-gray-700 text-gray-500'
        }`}
      >
        RADIO
      </button>
      <label className="flex items-center gap-1">
        <span className="sr-only">Voice speed</span>
        <input
          aria-label="Voice speed"
          type="range"
          min={80}
          max={125}
          value={Math.round(settings.rate * 100)}
          onChange={(event) => updateVoiceSettings({ rate: Number(event.target.value) / 100 })}
          className="w-12 accent-green-500"
        />
      </label>
      <span
        data-testid="voice-status"
        data-engine={engine}
        className="ml-auto text-[9px] tracking-wide text-gray-500"
        aria-live="polite"
      >
        {statusLabel}
      </span>
    </div>
  );
};

export default VoiceBar;
