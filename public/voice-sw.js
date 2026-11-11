/* OpenSTARS voice asset service worker — cache-first for model + ORT WASM. */
const CACHE = 'openstars-voice-v1';

function isVoiceAsset(url) {
  try {
    const u = new URL(url);
    if (u.origin !== self.location.origin) return false;
    if (u.pathname.startsWith('/voice/')) return true;
    if (/ort-wasm.*\.(wasm|mjs)$/i.test(u.pathname)) return true;
    if (/onnxruntime/i.test(u.pathname) && /\.(wasm|mjs)$/i.test(u.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('openstars-voice-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!isVoiceAsset(event.request.url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      if (res.ok) {
        try {
          await cache.put(event.request, res.clone());
        } catch {
          /* opaque / quota */
        }
      }
      return res;
    })(),
  );
});
