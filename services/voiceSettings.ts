export interface VoiceSettings {
  enabled: boolean;
  /** 0 to 1 */
  volume: number;
  radioEffect: boolean;
  /** 0.8 – 1.25, passed to the neural model and to speechSynthesis */
  rate: number;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  volume: 0.9,
  radioEffect: true,
  rate: 1,
};

const STORAGE_KEY = 'openstars_voice';

type Listener = () => void;
const listeners = new Set<Listener>();

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function sanitize(raw: Partial<VoiceSettings> | null): VoiceSettings {
  return {
    enabled: raw?.enabled !== false,
    volume: clamp(typeof raw?.volume === 'number' ? raw.volume : DEFAULT_VOICE_SETTINGS.volume, 0, 1),
    radioEffect: raw?.radioEffect !== false,
    rate: clamp(typeof raw?.rate === 'number' ? raw.rate : DEFAULT_VOICE_SETTINGS.rate, 0.8, 1.25),
  };
}

function load(): VoiceSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...DEFAULT_VOICE_SETTINGS };
    return sanitize(JSON.parse(saved) as Partial<VoiceSettings>);
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

let settings: VoiceSettings = typeof localStorage === 'undefined' ? { ...DEFAULT_VOICE_SETTINGS } : load();

export function getVoiceSettings(): VoiceSettings {
  return settings;
}

export function updateVoiceSettings(partial: Partial<VoiceSettings>): VoiceSettings {
  settings = sanitize({ ...settings, ...partial });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* private mode */
  }
  listeners.forEach((listener) => listener());
  return settings;
}

export function subscribeVoiceSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
