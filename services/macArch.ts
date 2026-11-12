/**
 * Detect Apple Silicon vs Intel for Mac desktop download links.
 * Pure helpers are unit-tested; browser I/O lives in detectMacArch().
 */

export type MacArch = 'arm64' | 'x64';

export interface ReleaseAssetLike {
  name: string;
  size: number;
  browser_download_url: string;
}

/** Map UA-CH architecture strings → MacArch (null if unrecognized). */
export function inferMacArchFromUaArchitecture(architecture: string | null | undefined): MacArch | null {
  if (!architecture) return null;
  const a = architecture.trim().toLowerCase();
  if (!a) return null;
  // Chromium UA-CH: "arm" / "x86". Also accept explicit arm64 / x86_64 spellings.
  if (a === 'arm' || a.includes('arm64') || a.includes('aarch64')) return 'arm64';
  if (a === 'x86' || a.includes('x86_64') || a.includes('x64') || a.includes('amd64')) return 'x64';
  return null;
}

/**
 * Infer from WebGL UNMASKED_RENDERER.
 * Apple Silicon GPUs report "Apple M…" / "Apple GPU"; Intel/AMD discrete/iGPU ⇒ x64.
 */
export function inferMacArchFromWebGlRenderer(renderer: string | null | undefined): MacArch | null {
  if (!renderer) return null;
  const r = renderer.trim();
  if (!r) return null;
  if (/Apple\s+M\d/i.test(r) || /Apple\s+GPU/i.test(r) || /\bApple\b.*\bM[1-9]\b/i.test(r)) {
    return 'arm64';
  }
  if (/Intel/i.test(r) || /AMD\b/i.test(r) || /Radeon/i.test(r) || /GeForce/i.test(r) || /NVIDIA/i.test(r)) {
    return 'x64';
  }
  return null;
}

/** Prefer UA-CH, then WebGL; default Apple Silicon (primary expo machines). */
export function resolveMacArch(hints: {
  uaArchitecture?: string | null;
  webGlRenderer?: string | null;
}): MacArch {
  return (
    inferMacArchFromUaArchitecture(hints.uaArchitecture)
    || inferMacArchFromWebGlRenderer(hints.webGlRenderer)
    || 'arm64'
  );
}

export function pickMacDmgForArch<T extends ReleaseAssetLike>(assets: T[], arch: MacArch): T | null {
  if (arch === 'arm64') {
    return (
      assets.find((a) => /aarch64.*\.dmg$/i.test(a.name))
      || assets.find((a) => /arm64.*\.dmg$/i.test(a.name))
      || null
    );
  }
  return (
    assets.find((a) => /(?:^|[^a-z])x64.*\.dmg$/i.test(a.name) || /x86_64.*\.dmg$/i.test(a.name))
    || assets.find((a) => /_x64\.dmg$/i.test(a.name))
    || null
  );
}

/** The other architecture's DMG (for the secondary under-link). */
export function pickMacDmgAlternate<T extends ReleaseAssetLike>(assets: T[], primaryArch: MacArch): T | null {
  return pickMacDmgForArch(assets, primaryArch === 'arm64' ? 'x64' : 'arm64');
}

/**
 * Prefer the current release's DMG for `arch`; if missing, use a prior release's assets
 * (e.g. Apple Silicon → desktop-v0.1.0 aarch64 until a signed arm64 build lands on latest).
 */
export function resolveMacDmgWithFallback<T extends ReleaseAssetLike>(
  primaryAssets: T[],
  fallbackAssets: T[],
  arch: MacArch,
): { asset: T; fromFallback: boolean } | null {
  const primary = pickMacDmgForArch(primaryAssets, arch);
  if (primary) return { asset: primary, fromFallback: false };
  const fallback = pickMacDmgForArch(fallbackAssets, arch);
  if (fallback) return { asset: fallback, fromFallback: true };
  return null;
}

export function macArchSecondaryLabel(primaryArch: MacArch): string {
  return primaryArch === 'arm64' ? 'On an Intel Mac? Download here' : 'On Apple Silicon? Download here';
}

function readWebGlRenderer(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return null;
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    return typeof renderer === 'string' ? renderer : null;
  } catch {
    return null;
  }
}

/**
 * Browser detection: UA Client Hints architecture when available, else WebGL renderer.
 * Defaults to arm64 when unknown.
 */
export async function detectMacArch(): Promise<MacArch> {
  let uaArchitecture: string | null = null;
  try {
    const uad = (navigator as Navigator & {
      userAgentData?: {
        getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
      };
    }).userAgentData;
    if (uad?.getHighEntropyValues) {
      const values = await uad.getHighEntropyValues(['architecture']);
      uaArchitecture = values.architecture ?? null;
    }
  } catch {
    /* ignore — fall through to WebGL */
  }
  return resolveMacArch({
    uaArchitecture,
    webGlRenderer: readWebGlRenderer(),
  });
}
