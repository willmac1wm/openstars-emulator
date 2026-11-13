import { PilotVoice, speakCallsign, voiceForCallsign } from './phraseology';
import { getVoiceSettings, VoiceSettings } from './voiceSettings';
import {
  applyTransformersVoiceEnv,
  localVoiceModelCached,
  registerVoiceServiceWorker,
  requestPersistentStorage,
} from './voiceAssets';
import { notifyPilotSpeechActive } from './soundEffects';
import {
  NATURAL_SLOW_FALLBACK,
  NATURAL_VOICE_FAILED,
  NO_SPEECH_VOICE,
  READBACK_AUDIO_FAILED,
} from './voiceErrors';
// Deep package exports hide these files. Importing the installed paths lets Vite
// emit them as same-origin assets instead of fetching the runtime from a CDN.
import ortWasm from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import ortWasmLoader from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url';

export const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

/** q8 maps to onnx/model_quantized.onnx in Transformers.js (about 92 MB). */
export const KOKORO_DTYPE = 'q8' as const;

/** Approximate quantized model size used when progress_callback omits totals. */
export const KOKORO_APPROX_BYTES = 92_361_116;

/** Instructor narration voice (not latency-critical; warm Kokoro OK). */
export const INSTRUCTOR_VOICE: PilotVoice = 'af_bella';

/** Typical classroom readback used for the post-warmup latency benchmark. */
export const BENCHMARK_PHRASE = 'Turn left heading two seven zero, American four twenty-one';

/** If first neural audio takes longer than this, auto-select Fast voice. */
export const FIRST_AUDIO_BUDGET_MS = 500;

const LOAD_TIMEOUT_MS = 90_000;
const STALL_TIMEOUT_MS = 20_000;
const SLOW_GENERATE_MS = 8_000;
/** Loads finishing this fast are treated as browser-cache hits. */
const CACHE_FAST_MS = 2_500;
const PHRASE_CACHE_MAX = 256;

export type VoicePhase = 'idle' | 'loading' | 'ready' | 'fallback';
export type VoiceDevice = 'none' | 'wasm' | 'webgpu';

export interface VoiceRuntime {
  phase: VoicePhase;
  /** 0–1 while the neural model is downloading. */
  progress: number;
  engine: 'none' | 'kokoro' | 'webspeech';
  /** True when the load completed from HTTP/Cache API quickly. */
  fromCache: boolean;
  /** True after a silent warm-up generate. */
  warmed: boolean;
  /** Wall-clock ms spent in the last load attempt (0 if not finished). */
  loadMs: number;
  /** Device used for the loaded Kokoro engine. */
  device: VoiceDevice;
  /**
   * True when post-warmup benchmark produced first audio within FIRST_AUDIO_BUDGET_MS.
   * Readbacks still default to Web Speech unless naturalVoices is on.
   */
  neuralFastEnough: boolean;
  /** Last measured generate latency for the benchmark phrase (ms). */
  lastGenerateMs: number;
}

type KokoroModule = typeof import('kokoro-js');
type KokoroEngine = InstanceType<KokoroModule['KokoroTTS']>;

interface SynthBackend {
  device: VoiceDevice;
  sawPartialProgress: boolean;
  generate: (
    text: string,
    opts: { voice: PilotVoice; speed: number; priority?: 'high' | 'low' },
  ) => Promise<{ samples: Float32Array; sampleRate: number }>;
}

let runtime: VoiceRuntime = {
  phase: 'idle',
  progress: 0,
  engine: 'none',
  fromCache: false,
  warmed: false,
  loadMs: 0,
  device: 'none',
  neuralFastEnough: false,
  lastGenerateMs: 0,
};
const runtimeListeners = new Set<() => void>();

let audioCtx: AudioContext | null = null;
let kokoro: SynthBackend | null = null;
let enginePromise: Promise<void> | null = null;
let useBrowser = false;
let forceBasic = false;
let preloadStarted = false;
let loadStartedAt = 0;
let kokoroDevice: VoiceDevice = 'none';

/**
 * TTS failure notices for the UI (comm log). speakPilot is fire-and-forget
 * with no error channel, so without this a failed readback vanished silently.
 * App subscribes and logs each notice once; repeats of the same message
 * within 10s are dropped so a bad voice setup does not flood COMM 1.
 */
let lastAudioNotice = '';
let lastAudioNoticeAt = 0;
const audioNoticeListeners = new Set<(message: string) => void>();

export function subscribeAudioNotice(listener: (message: string) => void): () => void {
  audioNoticeListeners.add(listener);
  return () => audioNoticeListeners.delete(listener);
}

export function emitAudioNotice(message: string): void {
  const now = Date.now();
  if (message === lastAudioNotice && now - lastAudioNoticeAt < 10_000) return;
  lastAudioNotice = message;
  lastAudioNoticeAt = now;
  audioNoticeListeners.forEach((listener) => listener(message));
}

interface Utterance {
  text: string;
  callsign: string;
}

const queue: Utterance[] = [];
let draining = false;

/** Short phrase → PCM cache (natural-voice path only). */
const phraseCache = new Map<string, { samples: Float32Array; sampleRate: number }>();
/** In-flight synthesis promises keyed by cacheKey so prewarm + Enter share work. */
const inflightChunks = new Map<string, Promise<{ samples: Float32Array; sampleRate: number }>>();
const prewarmedCallsigns = new Set<string>();

function setRuntime(partial: Partial<VoiceRuntime>) {
  runtime = { ...runtime, ...partial };
  runtimeListeners.forEach((listener) => listener());
}

export function getVoiceRuntime(): VoiceRuntime {
  return runtime;
}

export function subscribeVoiceRuntime(listener: () => void): () => void {
  runtimeListeners.add(listener);
  return () => runtimeListeners.delete(listener);
}

/** Human-readable status for menu / attract banners. */
export function voiceStatusLabel(rt: VoiceRuntime = runtime): string {
  const settings = typeof getVoiceSettings === 'function' ? getVoiceSettings() : null;
  if (forceBasic) return 'Using basic voice';
  if (rt.phase === 'fallback') return 'Natural voices failed — using Fast voice';
  if (rt.phase === 'loading') {
    return `Loading pilot voices… ${Math.round(rt.progress * 100)}%`;
  }
  if (rt.phase === 'ready' && rt.engine === 'kokoro') {
    if (settings?.naturalVoices) {
      return rt.fromCache ? 'Natural voices ready ✓ (cached)' : 'Natural voices ready ✓';
    }
    // Default classroom path: instant Web Speech; Kokoro stayed warm in the background.
    if (!rt.neuralFastEnough) return 'Fast voice ✓';
    return rt.fromCache ? 'Fast voice ✓ (neural ready, cached)' : 'Fast voice ✓ (neural ready)';
  }
  if (rt.engine === 'webspeech') return 'Fast voice ✓';
  return 'Pilot voices standby';
}

export function unlockAudio() {
  if (typeof window === 'undefined') return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
}

/**
 * Begin Kokoro download/init after first paint + idle time on the menu.
 * Does not block first paint. Audio unlock still waits for a gesture.
 */
export function preloadPilotVoice() {
  if (typeof window === 'undefined') return;
  if (forceBasic) return;
  if (!getVoiceSettings().enabled) return;
  if (preloadStarted || runtime.phase === 'ready' || runtime.phase === 'fallback') return;
  preloadStarted = true;
  const start = () => {
    void requestPersistentStorage();
    void registerVoiceServiceWorker();
    void ensureEngine();
  };
  // Two rAFs ≈ after first paint, then idle so the menu stays responsive.
  const afterPaint = () => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (typeof ric === 'function') {
      ric(start, { timeout: 2500 });
    } else {
      window.setTimeout(start, 400);
    }
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(afterPaint));
  } else {
    window.setTimeout(afterPaint, 0);
  }
}

/** Call from a click or keypress — unlocks audio and ensures the engine is loading. */
export function primePilotVoice() {
  unlockAudio();
  // Persist is more likely to succeed after a user gesture.
  void requestPersistentStorage();
  // Prime Web Speech voices even when neural is disabled — tutorial narration falls back here.
  void ensureSpeechVoices();
  if (!getVoiceSettings().enabled) return;
  preloadPilotVoice();
  void ensureEngine();
}

/**
 * Skip neural voices for this session (teacher escape hatch).
 * Future speakPilot calls use Web Speech immediately.
 */
export function useBasicVoiceNow() {
  forceBasic = true;
  useBrowser = true;
  kokoro = null;
  setRuntime({
    phase: 'fallback',
    progress: 1,
    engine: 'webspeech',
    fromCache: false,
    warmed: false,
    device: 'none',
    neuralFastEnough: false,
  });
}

/**
 * Pre-synthesize chunks for a readback in the background (while typing or adjusting sliders)
 * so pressing Enter hits the in-memory PCM cache with 0 ms synthesis wait.
 */
export function prewarmReadback(text: string, callsign: string) {
  if (!text || !callsign || forceBasic || useBrowser) return;
  const settings = getVoiceSettings();
  if (!settings.enabled || !kokoro || runtime.phase !== 'ready') return;
  const chunks = splitReadbackChunks(text);
  for (const chunk of chunks) {
    const key = cacheKey(chunk, callsign, settings.rate);
    if (phraseCache.has(key) || inflightChunks.has(key)) continue;
    void synthesizeChunk(chunk, callsign, settings.rate, 'low').catch(() => undefined);
  }
}

/**
 * Pre-synthesize the spoken callsign tail for active aircraft on the scope.
 * Because every readback ends with `, <Callsign>`, pre-caching the callsign chunk
 * cuts multi-chunk synthesis work in half.
 */
export function prewarmCallsigns(callsigns: string[]) {
  if (!callsigns.length || forceBasic || useBrowser) return;
  const settings = getVoiceSettings();
  if (!settings.enabled) return;
  const run = () => {
    if (!kokoro || runtime.phase !== 'ready') return;
    for (const cs of callsigns.slice(0, 12)) {
      if (!cs || prewarmedCallsigns.has(cs)) continue;
      prewarmedCallsigns.add(cs);
      const spoken = speakCallsign(cs);
      prewarmReadback(spoken, cs);
    }
  };
  if (kokoro && runtime.phase === 'ready') {
    run();
  } else {
    void ensureEngine().then(run).catch(() => undefined);
  }
}

/**
 * Speak a pilot readback.
 * Default: Web Speech starts immediately (~tens of ms) so Chromebooks stay snappy.
 * Natural voices (teacher toggle): Kokoro when ready, streamed in chunks; falls back if slow.
 * Never blocks the caller — aircraft state must update before/without awaiting this.
 */
export function speakPilot(text: string, callsign: string) {
  if (!text || !getVoiceSettings().enabled) return;
  unlockAudio();
  preloadPilotVoice();
  // Duck STARS CA beep under readbacks (modest gain already; this ducks further).
  notifyPilotSpeechActive(true);

  const settings = getVoiceSettings();
  const wantNatural = settings.naturalVoices && !forceBasic;

  // Instant path — classroom default and any time neural isn't opted-in / ready.
  if (!wantNatural || useBrowser || !kokoro || runtime.phase !== 'ready') {
    void ensureEngine();
    void speakBrowser(text, callsign, settings).finally(() => notifyPilotSpeechActive(false));
    return;
  }

  queue.push({ text, callsign });
  void drain();
}

function ensureEngine(): Promise<void> {
  if (forceBasic) {
    setRuntime({ phase: 'fallback', progress: 1, engine: 'webspeech' });
    return Promise.resolve();
  }
  if (!enginePromise) enginePromise = initEngine();
  return enginePromise;
}

/** True when Kokoro weights are already in Cache Storage (same-origin or transformers-cache). */
async function kokoroInBrowserCache(): Promise<boolean> {
  if (await localVoiceModelCached()) return true;
  if (typeof caches === 'undefined') return false;
  try {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) {
        if (/Kokoro|model_quantized\.onnx|\/voice\//i.test(req.url)) return true;
      }
    }
  } catch {
    /* private mode / missing Cache API */
  }
  return false;
}

async function webGpuAvailable(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

async function initEngine() {
  loadStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const cachedBefore = await kokoroInBrowserCache();
  setRuntime({
    phase: 'loading',
    progress: 0.02,
    engine: 'none',
    fromCache: false,
    warmed: false,
    loadMs: 0,
    device: 'none',
    neuralFastEnough: false,
    lastGenerateMs: 0,
  });
  try {
    const loaded = await withTimeout(loadKokoroBackend(), LOAD_TIMEOUT_MS);
    kokoro = loaded;
    kokoroDevice = loaded.device;
    useBrowser = false;
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - loadStartedAt;
    const fromCache = cachedBefore || (!loaded.sawPartialProgress && elapsed < CACHE_FAST_MS);
    setRuntime({
      phase: 'ready',
      progress: 1,
      engine: 'kokoro',
      fromCache,
      loadMs: Math.round(elapsed),
      device: loaded.device,
    });
    await warmUpAndBenchmark();
  } catch {
    kokoro = null;
    useBrowser = true;
    kokoroDevice = 'none';
    // Only announce when the user actually asked for natural voices;
    // the Fast-voice default preloads Kokoro in the background and a
    // failed preload there is an expected, silent fallback.
    if (getVoiceSettings().naturalVoices) emitAudioNotice(NATURAL_VOICE_FAILED);
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - loadStartedAt;
    setRuntime({
      phase: 'fallback',
      progress: 1,
      engine: 'webspeech',
      fromCache: false,
      warmed: false,
      loadMs: Math.round(elapsed),
      device: 'none',
      neuralFastEnough: false,
    });
  }
}

async function loadKokoroBackend(): Promise<SynthBackend> {
  if (typeof Worker !== 'undefined') {
    try {
      return await loadKokoroWorker();
    } catch {
      /* Fall back to in-process engine if module worker fails */
    }
  }
  return loadKokoroInProcess();
}

function loadKokoroWorker(): Promise<SynthBackend> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let nextJobId = 1;
    const pending = new Map<
      number,
      {
        resolve: (val: { samples: Float32Array; sampleRate: number }) => void;
        reject: (err: Error) => void;
      }
    >();

    let worker: Worker;
    try {
      worker = new Worker(new URL('./pilotVoice.worker.ts', import.meta.url), { type: 'module' });
    } catch (err) {
      reject(err);
      return;
    }

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'progress') {
        setRuntime({ phase: 'loading', progress: Math.max(runtime.progress, msg.progress || 0) });
        return;
      }

      if (msg.type === 'loaded' && !settled) {
        settled = true;
        const device: VoiceDevice = msg.device === 'webgpu' ? 'webgpu' : 'wasm';
        const sawPartialProgress = Boolean(msg.sawPartialProgress);
        resolve({
          device,
          sawPartialProgress,
          generate: (text, opts) =>
            new Promise((res, rej) => {
              const id = nextJobId++;
              pending.set(id, { resolve: res, reject: rej });
              worker.postMessage({
                type: 'generate',
                id,
                text,
                voice: opts.voice,
                speed: opts.speed,
                priority: opts.priority || 'high',
              });
            }),
        });
        return;
      }

      if (msg.type === 'init_error' && !settled) {
        settled = true;
        worker.terminate();
        reject(new Error(msg.error || 'Worker init failed'));
        return;
      }

      if (msg.type === 'generated') {
        const job = pending.get(msg.id);
        if (job) {
          pending.delete(msg.id);
          job.resolve({ samples: msg.samples, sampleRate: msg.sampleRate || 24000 });
        }
        return;
      }

      if (msg.type === 'error') {
        const job = pending.get(msg.id);
        if (job) {
          pending.delete(msg.id);
          job.reject(new Error(msg.error || 'Worker synth failed'));
        }
      }
    };

    worker.onerror = (err) => {
      if (!settled) {
        settled = true;
        worker.terminate();
        reject(err);
      }
    };

    worker.postMessage({ type: 'init' });
  });
}

async function loadKokoroInProcess(): Promise<SynthBackend> {
  const [{ KokoroTTS }, transformers] = await Promise.all([
    import('kokoro-js'),
    import('@huggingface/transformers'),
  ]);
  const env = transformers.env;
  applyTransformersVoiceEnv(env);
  try {
    const canThread = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 1;
    env.backends.onnx.wasm.numThreads = canThread ? Math.min(4, Math.max(1, cores)) : 1;
    const origin = window.location.origin;
    env.backends.onnx.wasm.wasmPaths = {
      wasm: new URL(ortWasm, origin).href,
      mjs: new URL(ortWasmLoader, origin).href,
    };
  } catch {
    /* single-thread wasm is the default when the field is missing */
  }

  const attempts: Array<{ device: 'wasm' | 'webgpu'; dtype: 'fp32' | 'fp16' | 'q8' }> = [];
  if (await webGpuAvailable()) {
    attempts.push({ device: 'webgpu', dtype: 'fp32' });
  }
  attempts.push({ device: 'wasm', dtype: KOKORO_DTYPE });

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const files = new Map<string, { loaded: number; total: number }>();
      let sawPartialProgress = false;
      const engine: KokoroEngine = await withActivityTimeout(
        (touch) =>
          KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
            dtype: attempt.dtype,
            device: attempt.device,
            progress_callback: (info: { status?: string; file?: string; loaded?: number; total?: number }) => {
              touch();
              if (info.status === 'progress') {
                const key = info.file || 'model';
                const total = info.total && info.total > 0 ? info.total : KOKORO_APPROX_BYTES;
                const loadedBytes = info.loaded || 0;
                if (loadedBytes > 0 && loadedBytes < total) sawPartialProgress = true;
                files.set(key, { loaded: loadedBytes, total });
                let sumLoaded = 0;
                let sumTotal = 0;
                for (const file of files.values()) {
                  sumLoaded += file.loaded;
                  sumTotal += file.total;
                }
                if (sumTotal > 0) {
                  setRuntime({ phase: 'loading', progress: Math.min(0.99, sumLoaded / sumTotal) });
                }
              } else if (info.status === 'ready' || info.status === 'done') {
                setRuntime({ phase: 'loading', progress: Math.max(runtime.progress, 0.95) });
              }
            },
          }),
        STALL_TIMEOUT_MS,
        LOAD_TIMEOUT_MS,
      );
      return {
        device: attempt.device,
        sawPartialProgress,
        generate: async (text, opts) => {
          const audio = await engine.generate(text, { voice: opts.voice, speed: opts.speed });
          return {
            samples: audio.audio,
            sampleRate: audio.sampling_rate || 24000,
          };
        },
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Kokoro failed to load');
}

/** Warm-up + latency benchmark; decides neuralFastEnough for status / natural path. */
async function warmUpAndBenchmark() {
  if (!kokoro || forceBasic) return;
  try {
    const voice = voiceForCallsign('AAL421') satisfies PilotVoice;
    await withTimeout(kokoro.generate('Roger.', { voice, speed: 1, priority: 'low' }), SLOW_GENERATE_MS);
    setRuntime({ warmed: true });

    const firstChunk = splitReadbackChunks(BENCHMARK_PHRASE)[0];
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const audio = await withTimeout(kokoro.generate(firstChunk, { voice, speed: 1, priority: 'low' }), SLOW_GENERATE_MS);
    const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    if (audio.samples?.length) {
      rememberPhrase(cacheKey(firstChunk, 'AAL421', 1), audio.samples, audio.sampleRate);
    }
    const neuralFastEnough = ms <= FIRST_AUDIO_BUDGET_MS;
    setRuntime({ lastGenerateMs: ms, neuralFastEnough });
  } catch {
    setRuntime({ warmed: true, neuralFastEnough: false, lastGenerateMs: SLOW_GENERATE_MS });
  }
}

/**
 * Measure Kokoro generate latency (for benches / diagnostics).
 * Does not play audio.
 */
export async function benchmarkGenerate(
  text: string,
  opts?: { callsign?: string },
): Promise<{ ms: number; ok: boolean; device: VoiceDevice }> {
  if (!kokoro) return { ms: -1, ok: false, device: 'none' };
  const voice = voiceForCallsign(opts?.callsign || 'AAL421') satisfies PilotVoice;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    await kokoro.generate(text, { voice, speed: 1, priority: 'high' });
    const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    return { ms, ok: true, device: kokoroDevice };
  } catch {
    const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    return { ms, ok: false, device: kokoroDevice };
  }
}

function cacheKey(text: string, callsign: string, rate: number): string {
  return `${ voiceForCallsign(callsign) }|${rate}|${text}`;
}

function rememberPhrase(key: string, samples: Float32Array, sampleRate: number) {
  if (phraseCache.size >= PHRASE_CACHE_MAX) {
    const first = phraseCache.keys().next().value;
    if (first) phraseCache.delete(first);
  }
  phraseCache.set(key, { samples, sampleRate });
}

function synthesizeChunk(
  chunk: string,
  callsign: string,
  rate: number,
  priority: 'high' | 'low' = 'high',
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const key = cacheKey(chunk, callsign, rate);
  const cached = phraseCache.get(key);
  if (cached) return Promise.resolve(cached);

  const existing = inflightChunks.get(key);
  if (existing) return existing;

  if (!kokoro) return Promise.reject(new Error('Kokoro not ready'));
  const voice = voiceForCallsign(callsign) satisfies PilotVoice;

  const promise = withTimeout(
    kokoro.generate(chunk, { voice, speed: rate, priority }),
    SLOW_GENERATE_MS,
  ).then((res) => {
    inflightChunks.delete(key);
    if (!res.samples || res.samples.length === 0) {
      throw new Error('Empty audio');
    }
    if (chunk.length <= 120) {
      rememberPhrase(key, res.samples, res.sampleRate);
    }
    return res;
  }).catch((err) => {
    inflightChunks.delete(key);
    throw err;
  });

  inflightChunks.set(key, promise);
  return promise;
}

/** Split a readback into short speakable chunks (callsign-ish tail often after comma). */
export function splitReadbackChunks(text: string): string[] {
  const parts = text
    .split(/(?<=[,.])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text];
}

async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const settings = getVoiceSettings();
      if (!settings.enabled) {
        queue.length = 0;
        break;
      }
      const item = queue.shift();
      if (!item) break;
      if (forceBasic || useBrowser || !kokoro || runtime.phase !== 'ready' || !settings.naturalVoices) {
        await speakBrowser(item.text, item.callsign, settings);
        continue;
      }
      const played = await speakNeuralChunked(item, settings);
      if (!played) {
        // Natural path failed or produced no audio (e.g. suspended
        // AudioContext) — fall back audibly instead of silently.
        emitAudioNotice(NATURAL_SLOW_FALLBACK);
        await speakBrowser(item.text, item.callsign, getVoiceSettings());
      }
    }
  } finally {
    draining = false;
    if (queue.length && getVoiceSettings().enabled) {
      void drain();
    } else {
      notifyPilotSpeechActive(false);
    }
  }
}

async function speakNeuralChunked(item: Utterance, settings: VoiceSettings): Promise<boolean> {
  if (!kokoro) return false;
  const fullKey = cacheKey(item.text, item.callsign, settings.rate);
  const cachedFull = phraseCache.get(fullKey);
  if (cachedFull) {
    setRuntime({ lastGenerateMs: 1 });
    return playSamples(cachedFull.samples, cachedFull.sampleRate, settings);
  }

  const chunks = splitReadbackChunks(item.text);
  let firstAudioAt = -1;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  try {
    // Pipeline all chunks immediately so chunk[i+1] synthesizes while chunk[i] plays out loud!
    const chunkPromises = chunks.map((chunk) =>
      synthesizeChunk(chunk, item.callsign, settings.rate, 'high'),
    );

    for (let i = 0; i < chunkPromises.length; i++) {
      const { samples, sampleRate } = await chunkPromises[i];
      if (firstAudioAt < 0) {
        firstAudioAt = Math.max(1, Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0));
        setRuntime({ lastGenerateMs: firstAudioAt });
      }
      // playSamples returning false means nothing audible happened
      // (no/suspended AudioContext) — fall back to Fast voice, don't
      // report the readback as spoken.
      if (!(await playSamples(samples, sampleRate, settings))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function playSamples(samples: Float32Array, sampleRate: number, settings: VoiceSettings): Promise<boolean> {
  unlockAudio();
  if (!audioCtx) return false;
  // A suspended context plays silence without throwing (autoplay policy
  // before any gesture) — treat it as not-played so the caller falls back.
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch {
      return false;
    }
    // Read through a plain string: TS narrows .state to 'suspended'
    // inside this branch and flags the running-check as impossible.
    const stateAfterResume: string = audioCtx.state;
    if (stateAfterResume !== 'running') return false;
  }
  const ctx = audioCtx;
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.getChannelData(0).set(samples as unknown as Float32Array<ArrayBuffer>);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = settings.volume;

  if (settings.radioEffect) {
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 300;
    highpass.Q.value = 0.7;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3400;
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 1600;
    presence.Q.value = 0.7;
    presence.gain.value = 2.5;
    const shaper = ctx.createWaveShaper();
    shaper.curve = radioCurve() as unknown as Float32Array<ArrayBuffer>;
    source.connect(highpass);
    highpass.connect(presence);
    presence.connect(lowpass);
    lowpass.connect(shaper);
    shaper.connect(gain);

    const noise = ctx.createBufferSource();
    const noiseBuffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * buffer.duration)), ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
    noise.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.012 * settings.volume;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1500;
    noiseFilter.Q.value = 0.6;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(gain);
    noise.start();
  } else {
    source.connect(gain);
  }

  gain.connect(ctx.destination);
  source.start();
  return new Promise<boolean>((resolve) => {
    source.onended = () => resolve(true);
  });
}

function radioCurve(): Float32Array {
  const curve = new Float32Array(256);
  const amount = 6;
  for (let i = 0; i < curve.length; i++) {
    const x = (i * 2) / curve.length - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

const NOVELTY_VOICE_RE = /zarvox|bells|bubbles|boing|trinoids|whisper|organ|cellos|bad news|good news|jester|wobble|albert|bahh|superstar|hysterical|deranged/i;
const PREFERRED_VOICE_RE = /natural|enhanced|premium|samantha|alex|daniel|ava|allison|tom|evan|nathan|google us english|google uk english|microsoft (aria|guy|jenny|ryan|sonia)/i;

function englishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith('en') && !NOVELTY_VOICE_RE.test(voice.name));
}

function browserVoice(callsign: string): SpeechSynthesisVoice | null {
  const allEn = englishVoices();
  if (allEn.length === 0) return null;
  const preferred = allEn.filter((voice) => PREFERRED_VOICE_RE.test(voice.name));
  const pool = preferred.length > 0 ? preferred : allEn;
  let hash = 0;
  for (let i = 0; i < callsign.length; i++) hash = (hash * 31 + callsign.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length];
}

/**
 * Safari/Chrome often return [] from getVoices() until `voiceschanged`.
 * Call from a user gesture when possible; waits briefly for the engine to populate.
 */
export function ensureSpeechVoices(timeoutMs = 1_200): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve([]);
  const existing = englishVoices();
  if (existing.length > 0) return Promise.resolve(existing);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        window.speechSynthesis.removeEventListener('voiceschanged', finish);
      } catch {
        /* ignore */
      }
      resolve(englishVoices());
    };
    try {
      window.speechSynthesis.addEventListener('voiceschanged', finish);
      // Poke the engine — required on Safari before voiceschanged fires.
      void window.speechSynthesis.getVoices();
    } catch {
      finish();
      return;
    }
    window.setTimeout(finish, timeoutMs);
  });
}

/** Short VHF mic click / squelch burst to give Web Speech tactile radio presence. */
function playRadioClick(settings: VoiceSettings, durationSec = 0.035) {
  if (!settings.radioEffect || !audioCtx) return;
  try {
    const ctx = audioCtx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = 1 - i / len;
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1650;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.value = 0.045 * settings.volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch {
    /* ignore audio context errors */
  }
}

/** Chrome pauses speechSynthesis after ~15s — keep alive + split long lines. */
function splitForSpeech(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1 && text.length > 160) {
    // Hard wrap very long single sentences.
    const chunks: string[] = [];
    let rest = text;
    while (rest.length > 140) {
      let cut = rest.lastIndexOf(' ', 140);
      if (cut < 60) cut = 140;
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) chunks.push(rest);
    return chunks;
  }
  return parts.length ? parts : [text];
}

/** Guards stale Web Speech utterances: each speakBrowser call bumps the
 * token, so an old chunk's onerror retry can never re-speak over a newer
 * readback that already cancelled it (the double-speak race). */
let browserSpeakToken = 0;

function speakBrowser(text: string, callsign: string, settings: VoiceSettings): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    emitAudioNotice(NO_SPEECH_VOICE);
    return Promise.resolve();
  }
  const token = ++browserSpeakToken;
  const chunks = splitForSpeech(text);
  const synth = window.speechSynthesis;

  return (async () => {
    unlockAudio();
    await ensureSpeechVoices();
    // Note: getVoices() can still be empty here on slow devices even
    // though a voice arrives a moment later, so we do NOT skip the
    // utterance on an empty list — speak is attempted and, if it errors
    // after the retry, the exhausted-error path reports the failure
    // instead of dropping the readback silently.

    // Safari drops the next utterance if speak() follows cancel() synchronously.
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }
    await new Promise<void>((r) => window.setTimeout(r, 50));

    playRadioClick(settings, 0.025);

    let idx = 0;
    let keepAlive: number | null = null;
    let visibilityHandler: (() => void) | null = null;
    let chunkRetries = 0;

    const cleanup = () => {
      if (keepAlive != null) window.clearInterval(keepAlive);
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      keepAlive = null;
      visibilityHandler = null;
    };

    await new Promise<void>((resolve) => {
      const finish = () => {
        cleanup();
        playRadioClick(settings, 0.04);
        resolve();
      };

      const speakNext = () => {
        // A newer readback already cancelled this one — never advance or
        // retry a stale chunk over it.
        if (token !== browserSpeakToken) {
          cleanup();
          resolve();
          return;
        }
        if (idx >= chunks.length) {
          finish();
          return;
        }
        const utter = new SpeechSynthesisUtterance(chunks[idx]);
        const voice = browserVoice(callsign);
        if (voice) utter.voice = voice;
        utter.lang = voice?.lang || 'en-US';
        utter.rate = settings.rate;
        utter.volume = Math.max(0.2, settings.volume);
        utter.onend = () => {
          if (token !== browserSpeakToken) return;
          chunkRetries = 0;
          idx += 1;
          speakNext();
        };
        utter.onerror = (ev) => {
          if (token !== browserSpeakToken) return;
          // Retry once after a short pause — Safari often errors on the first cold speak.
          const err = (ev as SpeechSynthesisErrorEvent).error;
          if (chunkRetries < 1 && err !== 'canceled') {
            chunkRetries += 1;
            window.setTimeout(() => speakNext(), 80);
            return;
          }
          // Retries exhausted: the chunk never sounded. Say so once —
          // the text readback is already in the comm log.
          if (err !== 'canceled') emitAudioNotice(READBACK_AUDIO_FAILED);
          chunkRetries = 0;
          idx += 1;
          speakNext();
        };
        try {
          synth.speak(utter);
          // If the engine stays idle (known headless / some Safari cold starts), advance.
          window.setTimeout(() => {
            if (!synth.speaking && !synth.pending && idx < chunks.length) {
              // Nudge resume; if still dead, skip chunk so tutorial never hangs.
              try {
                synth.resume();
              } catch {
                /* ignore */
              }
            }
          }, 400);
        } catch {
          finish();
        }
      };

      // Chrome bug: speechSynthesis freezes if the tab is backgrounded or after ~15s.
      if (typeof window.setInterval === 'function') {
        keepAlive = window.setInterval(() => {
          try {
            if (synth.speaking) synth.resume();
          } catch {
            /* ignore */
          }
        }, 10_000);
      }
      if (typeof document !== 'undefined' && document.addEventListener) {
        visibilityHandler = () => {
          if (document.visibilityState === 'visible') {
            try {
              synth.resume();
            } catch {
              /* ignore */
            }
          }
        };
        document.addEventListener('visibilitychange', visibilityHandler);
      }

      speakNext();
    });
  })();
}

function withActivityTimeout<T>(
  start: (touch: () => void) => Promise<T>,
  stallMs: number,
  maxTotalMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (stallTimer) clearTimeout(stallTimer);
      clearTimeout(totalTimer);
    };

    const armStall = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Pilot voice model stalled'));
      }, stallMs);
    };

    const totalTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Pilot voice model timed out'));
    }, maxTotalMs);

    armStall();

    start(armStall).then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Pilot voice model timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** True when Kokoro is loaded + warmed — good enough for non-latency-critical narration. */
export function isInstructorNaturalReady(): boolean {
  return Boolean(!forceBasic && kokoro && runtime.phase === 'ready' && runtime.warmed);
}

let instructorSource: AudioBufferSourceNode | null = null;
let instructorToken = 0;

export function stopInstructorAudio() {
  instructorToken += 1;
  try {
    instructorSource?.stop();
  } catch {
    /* already stopped */
  }
  instructorSource = null;
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

function instructorCacheKey(text: string, rate: number): string {
  return `instructor|${INSTRUCTOR_VOICE}|${rate}|${text}`;
}

/** Pre-synthesize an instructor caption while the current line plays. */
export function prewarmInstructorLine(text: string, rate = 1.05) {
  if (!text || !isInstructorNaturalReady() || !kokoro) return;
  const key = instructorCacheKey(text, rate);
  if (phraseCache.has(key) || inflightChunks.has(key)) return;
  const promise = withTimeout(
    kokoro.generate(text, { voice: INSTRUCTOR_VOICE, speed: rate, priority: 'low' }),
    SLOW_GENERATE_MS,
  ).then((res) => {
    inflightChunks.delete(key);
    if (res.samples?.length) rememberPhrase(key, res.samples, res.sampleRate);
    return res;
  }).catch((err) => {
    inflightChunks.delete(key);
    throw err;
  });
  inflightChunks.set(key, promise);
  void promise.catch(() => undefined);
}

/**
 * Narrate instructor text: natural Kokoro when fast enough (or cached); else Web Speech.
 * If Kokoro stalls beyond kokoroBudgetMs, fall back to Web Speech for that line.
 * Never blocks the tutorial UI — captions are authoritative.
 */
export function speakInstructorLine(
  text: string,
  opts?: { rate?: number; onend?: () => void; prewarmNext?: string; kokoroBudgetMs?: number },
): void {
  if (!text) {
    opts?.onend?.();
    return;
  }
  stopInstructorAudio();
  const token = instructorToken;
  const rate = opts?.rate ?? 1.05;
  // First Kokoro lines on WASM often take 3–5s; allow a bit more than pilot PTT budget,
  // but never leave the trainee in silence — we fall back on timeout / suspended audio.
  const budget = opts?.kokoroBudgetMs ?? 3_500;
  unlockAudio();
  void ensureSpeechVoices();

  if (opts?.prewarmNext) {
    prewarmInstructorLine(opts.prewarmNext, rate);
  }

  const fallbackBrowser = async () => {
    if (token !== instructorToken) return;
    await speakBrowser(text, 'INSTRUCTOR', {
      ...getVoiceSettings(),
      enabled: true,
      rate,
      radioEffect: false,
      volume: 1,
    });
    if (token === instructorToken) opts?.onend?.();
  };

  const key = instructorCacheKey(text, rate);
  const cached = phraseCache.has(key);
  // When neural is warm but too slow for interactive audio, use Web Speech immediately
  // so How to Play isn't silent for the whole Kokoro budget every line.
  const useNeural =
    isInstructorNaturalReady() && Boolean(kokoro) && (runtime.neuralFastEnough || cached);

  if (!useNeural) {
    void ensureEngine();
    void fallbackBrowser();
    return;
  }

  const play = async () => {
    try {
      let samples: Float32Array;
      let sampleRate: number;
      const hit = phraseCache.get(key);
      if (hit) {
        samples = hit.samples;
        sampleRate = hit.sampleRate;
      } else {
        const audio = await withTimeout(
          kokoro!.generate(text, { voice: INSTRUCTOR_VOICE, speed: rate, priority: 'high' }),
          budget,
        );
        samples = audio.samples;
        sampleRate = audio.sampleRate;
        if (samples?.length) rememberPhrase(key, samples, sampleRate);
      }
      if (token !== instructorToken) return;
      unlockAudio();
      if (audioCtx && audioCtx.state === 'suspended') {
        try {
          await audioCtx.resume();
        } catch {
          /* ignore */
        }
      }
      // Autoplay policy: suspended context plays silence without throwing — use Web Speech.
      if (!audioCtx || audioCtx.state !== 'running' || !samples?.length) {
        await fallbackBrowser();
        return;
      }
      const buffer = audioCtx.createBuffer(1, samples.length, sampleRate);
      buffer.getChannelData(0).set(samples as unknown as Float32Array<ArrayBuffer>);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      const gain = audioCtx.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(audioCtx.destination);
      instructorSource = source;
      source.onended = () => {
        if (instructorSource === source) instructorSource = null;
        if (token === instructorToken) opts?.onend?.();
      };
      source.start();
    } catch {
      await fallbackBrowser();
    }
  };
  void play();
}

/** Expose bench hooks for Playwright / console diagnostics (no PII). */
export function installVoiceDebugHooks() {
  if (typeof window === 'undefined') return;
  (window as unknown as { __OPENSTARS_VOICE__?: unknown }).__OPENSTARS_VOICE__ = {
    getVoiceRuntime,
    benchmarkGenerate,
    speakPilot,
    prewarmReadback,
    prewarmCallsigns,
    isInstructorNaturalReady,
    speakInstructorLine,
    prewarmInstructorLine,
    FIRST_AUDIO_BUDGET_MS,
  };
}

/** Test helper — reset module singletons between vitest cases. */
export function __resetPilotVoiceForTests() {
  runtime = {
    phase: 'idle',
    progress: 0,
    engine: 'none',
    fromCache: false,
    warmed: false,
    loadMs: 0,
    device: 'none',
    neuralFastEnough: false,
    lastGenerateMs: 0,
  };
  kokoro = null;
  enginePromise = null;
  useBrowser = false;
  forceBasic = false;
  preloadStarted = false;
  kokoroDevice = 'none';
  queue.length = 0;
  draining = false;
  phraseCache.clear();
  inflightChunks.clear();
  prewarmedCallsigns.clear();
  browserSpeakToken = 0;
  lastAudioNotice = '';
  lastAudioNoticeAt = 0;
  stopInstructorAudio();
}
