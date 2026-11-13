import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export const TAKE_HOME_URL = 'https://openstars-emulator.vercel.app/';

/**
 * Take-home QR code, generated entirely in the browser with the bundled
 * `qrcode` library — no network call, so it works offline at an expo.
 * Falls back to the plain URL + copy button if generation ever fails.
 */
const TakeHomeQr: React.FC<{ url?: string }> = ({ url = TAKE_HOME_URL }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then((src) => { if (alive) setDataUrl(src); })
      .catch(() => { if (alive) setDataUrl(null); });
    return () => { alive = false; };
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the URL text is still visible */
    }
  };

  return (
    <div data-testid="take-home-qr" className="flex items-center gap-3 bg-white text-black rounded-lg p-3">
      {dataUrl ? (
        <img src={dataUrl} alt={`QR code linking to ${url}`} className="w-24 h-24 shrink-0" />
      ) : (
        <div className="w-24 h-24 shrink-0 bg-gray-200 flex items-center justify-center text-center text-[10px] px-2">
          QR unavailable — use the link
        </div>
      )}
      <div className="min-w-0">
        <div className="font-bold text-sm">Play it at home</div>
        <div className="text-xs break-all font-mono">{url}</div>
        <button
          type="button"
          data-testid="copy-take-home-url"
          onClick={copy}
          className="mt-1 text-xs font-bold bg-black text-white px-2 py-1 rounded"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    </div>
  );
};

export default TakeHomeQr;
