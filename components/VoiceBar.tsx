import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { getVoiceSettings, subscribeVoiceSettings, updateVoiceSettings, VoiceSettings } from '../services/voiceSettings';
import { getVoiceRuntime, primePilotVoice, subscribeVoiceRuntime, VoiceRuntime } from '../services/pilotVoice';
import { getWebWhisperRuntime, subscribeWebWhisper, WebWhisperRuntime } from '../services/webWhisper';
import { isDesktopApp } from '../services/desktop';
import { isSpeechRecognitionSupported } from '../services/speechRecognition';

const VoiceBar: React.FC = () => {
  const [settings, setSettings] = useState<VoiceSettings>(getVoiceSettings);
  const [runtime, setRuntime] = useState<VoiceRuntime>(getVoiceRuntime);
  const [whisperRt, setWhisperRt] = useState<WebWhisperRuntime>(getWebWhisperRuntime);
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeVoiceSettings(() => setSettings(getVoiceSettings())), []);
  useEffect(() => subscribeVoiceRuntime(() => setRuntime(getVoiceRuntime())), []);
  useEffect(() => subscribeWebWhisper(setWhisperRt), []);

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
    ? 'Voice off'
    : engine === 'loading'
      ? `Loading ${Math.round(runtime.progress * 100)}%`
      : engine === 'kokoro'
        ? (runtime.device === 'webgpu' ? 'Natural AI (GPU)' : 'Natural AI')
        : engine === 'fallback'
          ? 'Fast (AI unavailable)'
          : 'Fast (instant)';

  const sttLabel = isDesktopApp()
    ? 'Desktop AI'
    : settings.accurateSpeech
      ? whisperRt.phase === 'ready'
        ? 'AI Mic (ready)'
        : whisperRt.phase === 'loading'
          ? `AI Mic ${Math.round(whisperRt.progress * 100)}%`
          : 'Browser Mic'
      : isSpeechRecognitionSupported()
        ? 'Browser Mic'
        : 'Unavailable';

  return (
    <div className="text-[10px] text-gray-400" aria-label="Pilot audio">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-pressed={settings.enabled}
          title="Turn pilot readback voices on or off"
          onClick={() => {
            const next = !settings.enabled;
            updateVoiceSettings({ enabled: next });
            if (next) primePilotVoice();
          }}
          className={`px-2 py-0.5 rounded border flex items-center gap-1 font-bold ${
            settings.enabled
              ? 'border-green-600 text-green-300 bg-green-900/40'
              : 'border-gray-700 text-gray-500'
          }`}
        >
          {settings.enabled ? <Volume2 size={11} /> : <VolumeX size={11} />}
          {settings.enabled ? 'VOICE ON' : 'VOICE OFF'}
        </button>

        <label className="flex items-center gap-1" title="Pilot & alert volume">
          <span className="sr-only">Voice volume</span>
          <input
            aria-label="Voice volume"
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.volume * 100)}
            onChange={(event) => updateVoiceSettings({ volume: Number(event.target.value) / 100 })}
            className="w-16 accent-green-500"
          />
        </label>

        <button
          type="button"
          data-testid="sound-effects-toggle"
          title="Gate chimes and alert tones"
          aria-pressed={settings.soundEffects}
          onClick={() => updateVoiceSettings({ soundEffects: !settings.soundEffects })}
          className={`px-1.5 py-0.5 rounded border ${
            settings.soundEffects ? 'border-cyan-600 text-cyan-200 bg-cyan-950/30' : 'border-gray-700 text-gray-500'
          }`}
        >
          CHIMES
        </button>

        <button
          type="button"
          data-testid="audio-settings-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`ml-auto px-2 py-0.5 rounded border flex items-center gap-1 ${
            open ? 'border-green-600 text-green-200 bg-gray-800' : 'border-gray-700 text-gray-400 hover:text-gray-200'
          }`}
        >
          <SlidersHorizontal size={10} />
          AUDIO
          {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>

      {open && (
        <div
          data-testid="audio-settings-drawer"
          className="mt-1.5 p-2 rounded bg-black/90 border border-gray-800 space-y-2 text-[10px]"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-gray-200 font-bold">Pilot Voice Style</div>
              <div className="text-gray-500">Fast responds instantly; AI sounds warmer</div>
            </div>
            <button
              type="button"
              data-testid="natural-voices-toggle"
              aria-pressed={settings.naturalVoices}
              onClick={() => {
                const next = !settings.naturalVoices;
                updateVoiceSettings({ naturalVoices: next });
                if (next) primePilotVoice();
              }}
              className={`shrink-0 px-2 py-1 rounded border font-bold ${
                settings.naturalVoices ? 'border-violet-500 text-violet-200 bg-violet-950/40' : 'border-gray-700 text-gray-300'
              }`}
            >
              {settings.naturalVoices ? 'Natural (AI)' : 'Fast'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-gray-200 font-bold">Mic Speech Recognition</div>
              <div className="text-gray-500">AI hears ATC callsigns better (runs locally)</div>
            </div>
            <button
              type="button"
              data-testid="accurate-speech-toggle"
              aria-pressed={settings.accurateSpeech}
              onClick={() => updateVoiceSettings({ accurateSpeech: !settings.accurateSpeech })}
              className={`shrink-0 px-2 py-1 rounded border font-bold ${
                settings.accurateSpeech ? 'border-violet-500 text-violet-200 bg-violet-950/40' : 'border-gray-700 text-gray-300'
              }`}
            >
              {settings.accurateSpeech ? 'AI Mic' : 'Browser'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-gray-200 font-bold">VHF Radio Filter</div>
              <div className="text-gray-500">Adds cockpit radio sound to pilot voices</div>
            </div>
            <button
              type="button"
              aria-pressed={settings.radioEffect}
              onClick={() => updateVoiceSettings({ radioEffect: !settings.radioEffect })}
              className={`shrink-0 px-2 py-1 rounded border font-bold ${
                settings.radioEffect ? 'border-amber-600 text-amber-200 bg-amber-950/30' : 'border-gray-700 text-gray-500'
              }`}
            >
              {settings.radioEffect ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-gray-200 font-bold">Conflict Alert Beep</div>
              <div className="text-gray-500">Warning tone during loss of separation</div>
            </div>
            <button
              type="button"
              data-testid="conflict-alert-toggle"
              aria-pressed={settings.conflictAlertSound}
              onClick={() => updateVoiceSettings({ conflictAlertSound: !settings.conflictAlertSound })}
              className={`shrink-0 px-2 py-1 rounded border font-bold ${
                settings.conflictAlertSound ? 'border-red-600 text-red-200 bg-red-950/30' : 'border-gray-700 text-gray-500'
              }`}
            >
              {settings.conflictAlertSound ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-gray-200 font-bold">Voice Speed ({settings.rate.toFixed(2)}x)</div>
            <input
              aria-label="Voice speed"
              type="range"
              min={80}
              max={125}
              value={Math.round(settings.rate * 100)}
              onChange={(event) => updateVoiceSettings({ rate: Number(event.target.value) / 100 })}
              className="w-24 accent-green-500"
            />
          </div>

          <div
            data-testid="voice-status"
            data-engine={engine}
            data-stt-engine={sttLabel}
            className="pt-1 border-t border-gray-800 text-[9px] text-gray-500 flex justify-between"
            aria-live="polite"
          >
            <span>Voice: {statusLabel}</span>
            <span>Mic: {sttLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceBar;
