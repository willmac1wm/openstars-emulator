/**
 * Desktop (Tauri) detection and capability helpers.
 * The web build never loads native models; desktop downloads Whisper weights on first launch
 * (or uses a local `fetch-desktop-models` bundle under resources/).
 */

export type DesktopPlatform = 'macos' | 'windows' | 'linux' | 'unknown';

export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__);
}

/** True when Vite was built with the desktop flag (Tauri beforeBuildCommand). */
export function isDesktopBuild(): boolean {
  return import.meta.env.VITE_OPENSTARS_DESKTOP === '1' || isDesktopApp();
}

export function detectWebOs(): DesktopPlatform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();
  if (platform.includes('mac') || ua.includes('mac os')) return 'macos';
  if (platform.includes('win') || ua.includes('windows')) return 'windows';
  if (platform.includes('linux') || ua.includes('linux')) return 'linux';
  return 'unknown';
}

export async function detectDesktopPlatform(): Promise<DesktopPlatform> {
  if (!isDesktopApp()) return detectWebOs();
  try {
    const { platform } = await import('@tauri-apps/plugin-os');
    const p = await platform();
    if (p === 'macos') return 'macos';
    if (p === 'windows') return 'windows';
    if (p === 'linux') return 'linux';
  } catch {
    /* plugin unavailable */
  }
  return detectWebOs();
}

export async function invokeDesktop<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isDesktopApp()) {
    throw new Error(`Desktop command unavailable in browser: ${cmd}`);
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export const DESKTOP_RELEASE_REPO = 'willmac1wm/openstars-emulator';
export const DESKTOP_RELEASE_TAG = 'desktop-v0.1.1';
/** Used when the current tag is missing an arch (e.g. Apple Silicon DMG until signed arm64 ships). */
export const DESKTOP_RELEASE_FALLBACK_TAG = 'desktop-v0.1.0';

export function desktopReleaseApiUrlForTag(tag: string): string {
  return `https://api.github.com/repos/${DESKTOP_RELEASE_REPO}/releases/tags/${tag}`;
}

export function desktopReleaseApiUrl(): string {
  return desktopReleaseApiUrlForTag(DESKTOP_RELEASE_TAG);
}

export function desktopReleasesPageUrl(): string {
  return `https://github.com/${DESKTOP_RELEASE_REPO}/releases/tag/${DESKTOP_RELEASE_TAG}`;
}
