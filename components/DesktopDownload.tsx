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

function pickAsset(assets: ReleaseAsset[], platform: DesktopPlatform): ReleaseAsset | null {
  const names = assets.map((a) => a.name.toLowerCase());
  if (platform === 'macos') {
    const dmg = assets.find((a) => /\.dmg$/i.test(a.name) || /macos|darwin|aarch64|x64.*app/i.test(a.name));
    return dmg || null;
  }
  if (platform === 'windows') {
    const msi = assets.find((a) => /\.msi$/i.test(a.name));
    if (msi) return msi;
    return assets.find((a) => /\.exe$/i.test(a.name)) || null;
  }
  return assets.find((a) => /\.AppImage|\.deb/i.test(a.name)) || null;
  void names;
}

/**
 * Bottom-of-menu download CTA for the web build only (hidden inside the desktop app).
 */
const DesktopDownload: React.FC = () => {
  const [platform] = useState<DesktopPlatform>(() => detectWebOs());
  const [asset, setAsset] = useState<ReleaseAsset | null>(null);
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
        const picked = pickAsset(data.assets || [], platform);
        if (!cancelled) {
          setAsset(picked);
          setMissing(!picked);
        }
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platform]);

  if (isDesktopApp()) return null;

  const label =
    platform === 'macos' ? 'Download for Mac' : platform === 'windows' ? 'Download for Windows' : 'Download desktop app';

  return (
    <section
      data-testid="desktop-download"
      className="w-full max-w-5xl mx-auto mt-8 mb-4 border border-gray-800 rounded-lg bg-gray-950/80 p-4 md:p-5"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex-1 space-y-1">
          <div className="text-white font-bold text-lg flex items-center gap-2">
            <Download size={18} className="text-green-400" /> Download desktop app
          </div>
          <p className="text-sm text-gray-400">
            Best for expos &amp; offline: better voice recognition (native Whisper) and natural Kokoro voices —
            fully offline installer. {DESKTOP_RELEASE_TAG}
            {asset ? ` · ${formatBytes(asset.size)}` : ''}
          </p>
        </div>
        <a
          data-testid="desktop-download-link"
          href={asset?.browser_download_url || desktopReleasesPageUrl()}
          className="shrink-0 inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-black font-bold px-4 py-3 rounded"
          rel="noopener noreferrer"
        >
          <Download size={16} />
          {missing ? 'View releases' : label}
        </a>
      </div>
      {missing && (
        <p className="text-[11px] text-amber-200/80 mt-2">
          Release assets publishing soon — opens the GitHub Releases page.
        </p>
      )}
    </section>
  );
};

export default DesktopDownload;
