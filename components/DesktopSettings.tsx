import React, { useEffect, useState } from 'react';
import { invokeDesktop, isDesktopApp } from '../services/desktop';
import { getDesktopSttStatus, initDesktopStt, DesktopSttStatus } from '../services/desktopStt';

interface TtsStatus {
  engine: string;
  modelId: string;
  phonemizer: string;
  licenseNote: string;
  ready: boolean;
}

interface DesktopSettingsProps {
  open: boolean;
  onClose: () => void;
}

const DesktopSettings: React.FC<DesktopSettingsProps> = ({ open, onClose }) => {
  const [stt, setStt] = useState<DesktopSttStatus | null>(null);
  const [tts, setTts] = useState<TtsStatus | null>(null);
  const [kiosk, setKiosk] = useState(false);

  useEffect(() => {
    if (!open || !isDesktopApp()) return;
    void (async () => {
      const status = (await getDesktopSttStatus()) || (await initDesktopStt());
      setStt(status);
      try {
        setTts(await invokeDesktop<TtsStatus>('tts_status'));
      } catch {
        setTts(null);
      }
    })();
  }, [open]);

  if (!open || !isDesktopApp()) return null;

  return (
    <div
      className="absolute inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
      data-testid="desktop-settings"
    >
      <div className="w-full max-w-lg bg-gray-950 border border-gray-700 rounded-lg p-4 space-y-3 text-green-300 font-mono">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-bold text-lg">Desktop settings</h2>
          <button type="button" onClick={onClose} className="text-xs border border-gray-600 px-2 py-1 rounded">
            Close
          </button>
        </div>
        <div className="text-sm space-y-2 bg-black/50 border border-gray-800 rounded p-3">
          <div className="text-cyan-300 font-bold text-xs uppercase">Speech recognition</div>
          <div>Engine: Whisper (whisper.cpp)</div>
          <div>Model: {stt?.modelId || 'loading…'}</div>
          <div>Backend: {stt?.backend || '—'}</div>
          <div>Startup bench: {stt?.lastBenchmarkMs ? `${stt.lastBenchmarkMs} ms` : '—'}</div>
          <div className="text-[11px] text-gray-500">
            Available: {(stt?.availableModels || []).join(', ') || 'none yet'}
          </div>
        </div>
        <div className="text-sm space-y-2 bg-black/50 border border-gray-800 rounded p-3">
          <div className="text-cyan-300 font-bold text-xs uppercase">Pilot voices</div>
          <div>Engine: {tts?.engine || 'Kokoro webview ONNX'}</div>
          <div>Model: {tts?.modelId || 'Kokoro-82M q8'}</div>
          <div>Phonemizer: {tts?.phonemizer || 'ATC G2P lexicon'}</div>
          <div className="text-[11px] text-gray-500">{tts?.licenseNote}</div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={kiosk}
            onChange={async (e) => {
              const next = e.target.checked;
              setKiosk(next);
              try {
                await invokeDesktop('set_kiosk', { enabled: next });
              } catch {
                /* ignore */
              }
            }}
          />
          Expo booth fullscreen / kiosk
        </label>
        <p className="text-[11px] text-gray-500">
          Publisher: OpenSTARS · No accounts · No analytics · Offline models bundled in the installer.
        </p>
      </div>
    </div>
  );
};

export default DesktopSettings;
