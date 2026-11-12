import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import {
  desktopReleaseApiUrl,
  desktopReleaseApiUrlForTag,
  desktopReleasesPageUrl,
  DESKTOP_RELEASE_FALLBACK_TAG,
  DESKTOP_RELEASE_TAG,
  detectWebOs,
  isDesktopApp,
  DesktopPlatform,
} from '../services/desktop';
import {
  detectMacArch,
  macArchSecondaryLabel,
  MacArch,
  pickMacDmgAlternate,
  pickMacDmgForArch,
  ReleaseAssetLike,
  resolveMacDmgWithFallback,
} from '../services/macArch';

type ReleaseAsset = ReleaseAssetLike;

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(0)} MB`;
}

function pickWindows(assets: ReleaseAsset[]): ReleaseAsset | null {
  return (
    assets.find((a) => /\.msi$/i.test(a.name))
    || assets.find((a) => /\.exe$/i.test(a.name))
    || null
  );
}

async function fetchReleaseAssets(tagUrl: string): Promise<ReleaseAsset[]> {
  const res = await fetch(tagUrl, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { assets?: ReleaseAsset[] };
  return data.assets || [];
}

/**
 * Bottom-of-menu download CTA for the web build only (hidden inside the desktop app).
 * Mac button picks arm64 vs Intel DMG from detected architecture; Windows stays MSI.
 * If the current tag lacks an arch (e.g. no signed aarch64 yet), falls back to the prior tag.
 */
const DesktopDownload: React.FC = () => {
  const [platform] = useState<DesktopPlatform>(() => detectWebOs());
  const [macArch, setMacArch] = useState<MacArch>('arm64');
  const [mac, setMac] = useState<ReleaseAsset | null>(null);
  const [macAlt, setMacAlt] = useState<ReleaseAsset | null>(null);
  const [macFromFallback, setMacFromFallback] = useState(false);
  const [win, setWin] = useState<ReleaseAsset | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (isDesktopApp()) return;
    let cancelled = false;
    (async () => {
      const arch = await detectMacArch();
      if (cancelled) return;
      setMacArch(arch);
      try {
        const [primaryAssets, fallbackAssets] = await Promise.all([
          fetchReleaseAssets(desktopReleaseApiUrl()),
          fetchReleaseAssets(desktopReleaseApiUrlForTag(DESKTOP_RELEASE_FALLBACK_TAG)),
        ]);
        if (cancelled) return;

        const resolved = resolveMacDmgWithFallback(primaryAssets, fallbackAssets, arch);
        const altPrimary = pickMacDmgAlternate(primaryAssets, arch);
        const altFallback = !altPrimary
          ? pickMacDmgForArch(fallbackAssets, arch === 'arm64' ? 'x64' : 'arm64')
          : null;
        const nextWin = pickWindows(primaryAssets) || pickWindows(fallbackAssets);

        setMac(resolved?.asset ?? null);
        setMacFromFallback(Boolean(resolved?.fromFallback));
        setMacAlt(altPrimary || altFallback);
        setWin(nextWin);
        setMissing(!resolved && !nextWin);
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isDesktopApp()) return null;

  const macPrimary = platform === 'macos';
  const winPrimary = platform === 'windows';
  const macLabelArch = macArch === 'arm64' ? 'Apple Silicon' : 'Intel';

  return (
    <section
      data-testid="desktop-download"
      className="w-full max-w-5xl mx-auto mt-8 mb-4 border border-gray-800 rounded-lg bg-gray-950/80 p-4 md:p-5"
    >
      <div className="flex flex-col gap-3">
        <div className="space-y-1">
          <div className="text-white font-bold text-lg flex items-center gap-2">
            <Download size={18} className="text-green-400" /> Download desktop app
          </div>
          <p className="text-sm text-gray-400">
            Best for expos &amp; offline: better voice recognition (native Whisper) and natural Kokoro voices —
            fully offline installer. {DESKTOP_RELEASE_TAG} — Intel Mac DMGs are Developer ID signed &amp; notarized;
            Windows may still show SmartScreen until Authenticode is added.
            {macFromFallback ? (
              <>
                {' '}
                Apple Silicon currently links to {DESKTOP_RELEASE_FALLBACK_TAG} until a signed arm64 build is published.
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <div className="flex flex-col gap-1 items-stretch sm:items-start">
            <a
              data-testid="desktop-download-mac"
              data-mac-arch={macArch}
              data-mac-fallback={macFromFallback ? DESKTOP_RELEASE_FALLBACK_TAG : undefined}
              href={mac?.browser_download_url || desktopReleasesPageUrl()}
              className={`inline-flex items-center justify-center gap-2 font-bold px-4 py-3 rounded ${
                macPrimary
                  ? 'bg-green-600 hover:bg-green-500 text-black'
                  : 'border border-gray-600 text-gray-200 hover:border-green-500 hover:text-white'
              }`}
              rel="noopener noreferrer"
            >
              <Download size={16} />
              {mac
                ? `Mac ${macLabelArch} (.dmg · ${formatBytes(mac.size)})`
                : 'Mac (releases)'}
            </a>
            {macAlt && (
              <a
                data-testid="desktop-download-mac-alt"
                href={macAlt.browser_download_url}
                className="text-[11px] text-gray-500 hover:text-green-300 underline underline-offset-2 px-1"
                rel="noopener noreferrer"
              >
                {macArchSecondaryLabel(macArch)}
              </a>
            )}
          </div>
          <a
            data-testid="desktop-download-windows"
            href={win?.browser_download_url || desktopReleasesPageUrl()}
            className={`inline-flex items-center justify-center gap-2 font-bold px-4 py-3 rounded ${
              winPrimary
                ? 'bg-green-600 hover:bg-green-500 text-black'
                : 'border border-gray-600 text-gray-200 hover:border-green-500 hover:text-white'
            }`}
            rel="noopener noreferrer"
          >
            <Download size={16} />
            {win ? `Windows (.msi · ${formatBytes(win.size)})` : 'Windows (releases)'}
          </a>
          <a
            data-testid="desktop-download-link"
            href={desktopReleasesPageUrl()}
            className="inline-flex items-center justify-center gap-2 border border-gray-700 text-gray-400 hover:text-white px-3 py-3 rounded text-sm"
            rel="noopener noreferrer"
          >
            All assets
          </a>
        </div>
        {missing && (
          <p className="text-[11px] text-amber-200/80">
            Release assets publishing soon — opens the GitHub Releases page.
          </p>
        )}
      </div>
    </section>
  );
};

export default DesktopDownload;
