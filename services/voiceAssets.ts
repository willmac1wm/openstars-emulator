/**
 * Same-origin Kokoro asset layout + browser persistence helpers.
 * Model files live under /voice/onnx-community/Kokoro-82M-v1.0-ONNX/ (see scripts/fetch-kokoro-assets.mjs).
 */

export const VOICE_LOCAL_MODEL_PATH = '/voice/';

/** Configure @huggingface/transformers env for same-origin model + Cache API. */
export function applyTransformersVoiceEnv(env: {
  allowLocalModels: boolean;
  allowRemoteModels: boolean;
  localModelPath: string;
  useBrowserCache: boolean;
}): void {
  env.allowLocalModels = true;
  // Prefer local; keep remote as last-resort fallback if public/voice is missing in a broken deploy.
  env.allowRemoteModels = true;
  env.localModelPath = VOICE_LOCAL_MODEL_PATH;
  env.useBrowserCache = true;
}

/** Ask Chrome to keep Cache Storage / IndexedDB across eviction pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (navigator.storage.persisted && (await navigator.storage.persisted())) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Register the cache-first service worker for /voice/ assets and ORT WASM. */
export async function registerVoiceServiceWorker(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.register('/voice-sw.js', { scope: '/' });
    await reg.update().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/** True when same-origin /voice model weights are present in Cache Storage or HTTP cache probe. */
export async function localVoiceModelCached(): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) {
        if (/\/voice\/.*Kokoro|model_quantized\.onnx/i.test(req.url)) return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}
