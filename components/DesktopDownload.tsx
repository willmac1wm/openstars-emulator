import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import {
  desktopReleaseApiUrl,
  desktopReleasesPageUrl,
  DESKTOP_RELEASE_TAG,
  detectWebOs,
  isDesktopApp,
  DesktopPlatform,
} from '../services/desktop';

interface ReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(0)} MB`;
}

function pickMac(assets: ReleaseAsset[]): ReleaseAsset | null {
  // Prefer Apple Silicon .dmg (primary expo machines); fall back to any .dmg.
  return (
    assets.find((a) => /aarch64.*\.dmg$/i.test(a.name))
    || assets.find((a) => /\.dmg$/i.test(a.name))
    || null
  );
}

function pickWindows(assets: ReleaseAsset[]): ReleaseAsset | null {
  return (
    assets.find((a) => /\.msi$/i.test(a.name))
    || assets.find((a) => /\.exe$/i.test(a.name))
    || null
  );
}

/**
 * Bottom-of-menu download CTA for the web build only (hidden inside the desktop app).
 * Always offers Mac + Windows when release assets exist (Linux visitors still get both).
 */
const DesktopDownload: React.FC = () => {
  const [platform] = useState<DesktopPlatform>(() => detectWebOs());
  const [mac, setMac] = useState<ReleaseAsset | null>(null);
  const [win, setWin] = useState<ReleaseAsset | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (isDesktopApp()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(desktopReleaseApiUrl(), {
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) {
          if (!cancelled) setMissing(true);
          return;
        }
        const data = (await res.json()) as { assets?: ReleaseAsset[] };
        const assets = data.assets || [];
        const nextMac = pickMac(assets);
        const nextWin = pickWindows(assets);
        if (!cancelled) {
          setMac(nextMac);
          setWin(nextWin);
          setMissing(!nextMac && !nextWin);
        }
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
            fully offline installer. {DESKTOP_RELEASE_TAG} (unsigned pre-release — Gatekeeper / SmartScreen may warn).
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <a
            data-testid="desktop-download-mac"
            href={mac?.browser_download_url || desktopReleasesPageUrl()}
            className={`inline-flex items-center justify-center gap-2 font-bold px-4 py-3 rounded ${
              macPrimary
                ? 'bg-green-600 hover:bg-green-500 text-black'
                : 'border border-gray-600 text-gray-200 hover:border-green-500 hover:text-white'
            }`}
            rel="noopener noreferrer"
          >
            <Download size={16} />
            {mac ? `Mac (.dmg · ${formatBytes(mac.size)})` : 'Mac (releases)'}
          </a>
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
