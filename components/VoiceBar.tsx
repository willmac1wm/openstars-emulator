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
    : settings.naturalVoices && runtime.engine === 'kokoro' && runtime.phase === 'ready'
      ? 'kokoro'
      : runtime.phase === 'loading'
        ? 'loading'
        : 'webspeech';

  const statusLabel = engine === 'off'
    ? 'VOICE OFF'
    : engine === 'loading'
      ? `LOADING ${Math.round(runtime.progress * 100)}%`
      : engine === 'kokoro'
        ? (runtime.device === 'webgpu' ? 'NATURAL·GPU' : 'NATURAL')
        : 'FAST';

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
      <button
        type="button"
        data-testid="natural-voices-toggle"
        title="Natural Kokoro voices are warmer but often slower on Chromebooks. Default is Fast voice (Web Speech)."
        aria-pressed={settings.naturalVoices}
        onClick={() => {
          const next = !settings.naturalVoices;
          updateVoiceSettings({ naturalVoices: next });
          if (next) primePilotVoice();
        }}
        className={`px-1.5 py-0.5 rounded border ${
          settings.naturalVoices ? 'border-violet-600 text-violet-200' : 'border-gray-700 text-gray-500'
        }`}
      >
        {settings.naturalVoices ? 'NATURAL' : 'FAST'}
      </button>
      <button
        type="button"
        data-testid="accurate-speech-toggle"
        title="Accurate speech (beta): on-device Whisper tiny.en via WebGPU (~45MB). Falls back to browser speech if unavailable. Audio never leaves your device."
        aria-pressed={settings.accurateSpeech}
        onClick={() => updateVoiceSettings({ accurateSpeech: !settings.accurateSpeech })}
        className={`px-1.5 py-0.5 rounded border ${
          settings.accurateSpeech ? 'border-violet-500 text-violet-100' : 'border-gray-700 text-gray-500'
        }`}
      >
        {settings.accurateSpeech ? 'STT·AI' : 'STT'}
      </button>
      <button
        type="button"
        data-testid="sound-effects-toggle"
        title="Gate success chimes and penalty tones (Web Audio). Does not mute pilot readbacks."
        aria-pressed={settings.soundEffects}
        onClick={() => updateVoiceSettings({ soundEffects: !settings.soundEffects })}
        className={`px-1.5 py-0.5 rounded border ${
          settings.soundEffects ? 'border-cyan-600 text-cyan-200' : 'border-gray-700 text-gray-500'
        }`}
      >
        SFX
      </button>
      <button
        type="button"
        data-testid="conflict-alert-toggle"
        title="STARS-like Conflict Alert beep while a loss of separation is active. Default on. Muted when SFX is off."
        aria-pressed={settings.conflictAlertSound}
        onClick={() => updateVoiceSettings({ conflictAlertSound: !settings.conflictAlertSound })}
        className={`px-1.5 py-0.5 rounded border ${
          settings.conflictAlertSound ? 'border-red-600 text-red-200' : 'border-gray-700 text-gray-500'
        }`}
      >
        CA
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
        {runtime.lastGenerateMs > 0 && settings.naturalVoices ? ` · ${runtime.lastGenerateMs}ms` : ''}
      </span>
    </div>
  );
};

export default VoiceBar;
