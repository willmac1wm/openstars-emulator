import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { getVoiceSettings, subscribeVoiceSettings, updateVoiceSettings, VoiceSettings } from '../services/voiceSettings';
import { getVoiceRuntime, primePilotVoice, subscribeVoiceRuntime, VoiceRuntime } from '../services/pilotVoice';
import { getWebWhisperRuntime, subscribeWebWhisper, WebWhisperRuntime } from '../services/webWhisper';
import { isDesktopApp } from '../services/desktop';
import { isSpeechRecognitionSupported } from '../services/speechRecognition';

const VoiceBar: React.FC = () => {
  const [settings, setSettings] = useState<VoiceSettings>(getVoiceSettings);
  const [runtime, setRuntime] = useState<VoiceRuntime>(getVoiceRuntime);
  const [whisperRt, setWhisperRt] = useState<WebWhisperRuntime>(getWebWhisperRuntime);

  useEffect(() => subscribeVoiceSettings(() => setSettings(getVoiceSettings())), []);
  useEffect(() => subscribeVoiceRuntime(() => setRuntime(getVoiceRuntime())), []);
  useEffect(() => subscribeWebWhisper(setWhisperRt), []);

  // TTS engine actually in use — not just the toggle the user picked.
  // 'fallback' matters: natural was requested but Kokoro failed to load,
  // so Fast voice is speaking; previously the bar just said FAST.
  const engine = !settings.enabled
    ? 'off'
    : settings.naturalVoices && runtime.engine === 'kokoro' && runtime.phase === 'ready'
      ? 'kokoro'
      : settings.naturalVoices && runtime.phase === 'fallback'
        ? 'fallback'
        : runtime.phase === 'loading'
          ? 'loading'
          : 'webspeech';

  const statusLabel = engine === 'off'
    ? 'VOICE OFF'
    : engine === 'loading'
      ? `LOADING ${Math.round(runtime.progress * 100)}%`
      : engine === 'kokoro'
        ? (runtime.device === 'webgpu' ? 'NATURAL·GPU' : 'NATURAL')
        : engine === 'fallback'
          ? 'FAST·NAT FAILED'
          : 'FAST';

  // STT engine actually in use for the next PTT press.
  const sttLabel = isDesktopApp()
    ? 'DESK-WHISPER'
    : settings.accurateSpeech
      ? whisperRt.phase === 'ready'
        ? 'WHISPER'
        : whisperRt.phase === 'loading'
          ? `WHISPER ${Math.round(whisperRt.progress * 100)}%`
          : 'WEB·AI ✕'
      : isSpeechRecognitionSupported()
        ? 'WEB'
        : '—';
  const sttTitle = isDesktopApp()
    ? 'Speech-to-text: desktop Whisper (on-device)'
    : settings.accurateSpeech
      ? whisperRt.phase === 'ready'
        ? 'Speech-to-text: on-device Whisper (ready)'
        : whisperRt.phase === 'loading'
          ? `Accurate speech loading ${Math.round(whisperRt.progress * 100)}% — using browser mic for now`
          : whisperRt.phase === 'unsupported'
            ? 'Accurate speech needs WebGPU — using browser mic'
            : whisperRt.phase === 'error'
              ? 'Accurate speech failed to load — using browser mic'
              : 'Accurate speech warming up — using browser mic for now'
      : isSpeechRecognitionSupported()
        ? 'Speech-to-text: browser Web Speech (Chrome/Edge)'
        : 'Speech-to-text unavailable in this browser — use tap/type';

  const naturalTitle = engine === 'fallback'
    ? 'Natural voices failed to load — using Fast voice'
    : 'Natural Kokoro voices are warmer but often slower on Chromebooks. Default is Fast voice (Web Speech).';
  const accurateTitle = settings.accurateSpeech ? sttTitle
    : 'Accurate speech (beta): on-device Whisper tiny.en via WebGPU (~45MB). Falls back to browser speech if unavailable. Audio never leaves your device.';

  return (
    <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-400" aria-label="Pilot voice">
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
        title={naturalTitle}
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
        title={accurateTitle}
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
        data-stt-engine={sttLabel}
        title={`Pilot voice (text-to-speech): ${statusLabel}. Speech-to-text: ${sttTitle}`}
        className="ml-auto text-[9px] tracking-wide text-gray-500"
        aria-live="polite"
      >
        {statusLabel} · STT {sttLabel}
        {runtime.lastGenerateMs > 0 && settings.naturalVoices ? ` · ${runtime.lastGenerateMs}ms` : ''}
      </span>
    </div>
  );
};

export default VoiceBar;
