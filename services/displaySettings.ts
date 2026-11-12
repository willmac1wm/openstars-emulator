/**
 * Scope display prefs (J-rings, etc.). Persisted in localStorage.
 */

export interface DisplaySettings {
  /** Draw a 3 NM separation ring around every target (STARS J-ring style). Off by default. */
  jRings3Nm: boolean;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  jRings3Nm: false,
};

const STORAGE_KEY = 'openstars_display_settings';

function load(): DisplaySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DISPLAY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<DisplaySettings>;
    return {
      jRings3Nm: Boolean(parsed.jRings3Nm),
    };
  } catch {
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }
}

let settings: DisplaySettings =
  typeof localStorage === 'undefined' ? { ...DEFAULT_DISPLAY_SETTINGS } : load();

const listeners = new Set<(s: DisplaySettings) => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* private mode / quota */
  }
}

export function getDisplaySettings(): DisplaySettings {
  return { ...settings };
}

export function updateDisplaySettings(patch: Partial<DisplaySettings>): DisplaySettings {
  settings = { ...settings, ...patch };
  persist();
  listeners.forEach((fn) => fn(getDisplaySettings()));
  return getDisplaySettings();
}

export function subscribeDisplaySettings(fn: (s: DisplaySettings) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Typed ATC-style display commands (no callsign). Returns null if not a display cmd. */
export function parseDisplayCommand(raw: string): { kind: 'jrings'; on?: boolean } | null {
  const cmd = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!cmd) return null;

  // ON / OFF variants
  const onOff = cmd.match(/^(?:JRINGS?|J-?RINGS?|3\s*NM(?:\s*RING)?|RING(?:S)?)\s+(ON|OFF)$/);
  if (onOff) {
    return { kind: 'jrings', on: onOff[1] === 'ON' };
  }

  // Toggle
  if (
    /^(?:JRINGS?|J-?RINGS?|3\s*NM(?:\s*RING)?|RING(?:S)?)$/.test(cmd)
  ) {
    return { kind: 'jrings' };
  }

  return null;
}
