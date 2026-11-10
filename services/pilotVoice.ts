import { PilotVoice, voiceForCallsign } from './phraseology';
import { getVoiceSettings, VoiceSettings } from './voiceSettings';
// Deep package exports hide these files. Importing the installed paths lets Vite
// emit them as same-origin assets instead of fetching the runtime from a CDN.
import ortWasm from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import ortWasmLoader from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url';

export const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

/** q8 maps to onnx/model_quantized.onnx in Transformers.js (about 92 MB). */
export const KOKORO_DTYPE = 'q8' as const;

/** Approximate quantized model size used when progress_callback omits totals. */
export const KOKORO_APPROX_BYTES = 92_361_116;

const LOAD_TIMEOUT_MS = 90_000;
const SLOW_GENERATE_MS = 8_000;
/** Loads finishing this fast are treated as browser-cache hits. */
const CACHE_FAST_MS = 2_500;

export type VoicePhase = 'idle' | 'loading' | 'ready' | 'fallback';

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
}

type KokoroModule = typeof import('kokoro-js');
type KokoroEngine = InstanceType<KokoroModule['KokoroTTS']>;

let runtime: VoiceRuntime = {
  phase: 'idle',
  progress: 0,
  engine: 'none',
  fromCache: false,
  warmed: false,
  loadMs: 0,
};
const runtimeListeners = new Set<() => void>();

let audioCtx: AudioContext | null = null;
let kokoro: KokoroEngine | null = null;
let enginePromise: Promise<void> | null = null;
let useBrowser = false;
let forceBasic = false;
let preloadStarted = false;
let loadStartedAt = 0;

interface Utterance {
  text: string;
  callsign: string;
}

const queue: Utterance[] = [];
let draining = false;

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
  if (forceBasic || rt.phase === 'fallback' || rt.engine === 'webspeech') {
    return 'Using basic voice';
  }
  if (rt.phase === 'ready' && rt.engine === 'kokoro') {
    return rt.fromCache ? 'Pilot voices ready ✓ (cached)' : 'Pilot voices ready ✓';
  }
  if (rt.phase === 'loading') {
    return `Loading pilot voices… ${Math.round(rt.progress * 100)}%`;
  }
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
 * Begin Kokoro download/init during idle time on the menu.
 * Does not require a click (fetch/WASM init only). Audio unlock still waits for a gesture.
 */
export function preloadPilotVoice() {
  if (typeof window === 'undefined') return;
  if (forceBasic) return;
  if (!getVoiceSettings().enabled) return;
  if (preloadStarted || runtime.phase === 'ready' || runtime.phase === 'fallback') return;
  preloadStarted = true;
  const start = () => {
    void ensureEngine();
  };
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === 'function') {
    ric(start, { timeout: 1500 });
  } else {
    window.setTimeout(start, 0);
  }
}

/** Call from a click or keypress — unlocks audio and ensures the engine is loading. */
export function primePilotVoice() {
  unlockAudio();
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
  setRuntime({ phase: 'fallback', progress: 1, engine: 'webspeech', fromCache: false, warmed: false });
}

/**
 * Speak a pilot readback.
 * If Kokoro is not ready yet, use Web Speech immediately so the student always
 * hears something — never silent-wait on the first clearance.
 */
export function speakPilot(text: string, callsign: string) {
  if (!text || !getVoiceSettings().enabled) return;
  unlockAudio();
  preloadPilotVoice();

  if (forceBasic || useBrowser || !kokoro || runtime.phase !== 'ready') {
    void ensureEngine(); // keep loading in background
    void speakBrowser(text, callsign, getVoiceSettings());
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

/** True when transformers.js already stashed Kokoro weights in the Cache API. */
async function kokoroInBrowserCache(): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) {
        if (/Kokoro|model_quantized\.onnx/i.test(req.url)) return true;
      }
    }
  } catch {
    /* private mode / missing Cache API */
  }
  return false;
}

async function initEngine() {
  loadStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const cachedBefore = await kokoroInBrowserCache();
  setRuntime({ phase: 'loading', progress: 0.02, engine: 'none', fromCache: false, warmed: false, loadMs: 0 });
  try {
    const loaded = await withTimeout(loadKokoro(), LOAD_TIMEOUT_MS);
    kokoro = loaded.engine;
    useBrowser = false;
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - loadStartedAt;
    // Fast CDN ≠ cache. Prefer Cache API presence, else "no partial download progress".
    const fromCache = cachedBefore || (!loaded.sawPartialProgress && elapsed < CACHE_FAST_MS);
    setRuntime({ phase: 'ready', progress: 1, engine: 'kokoro', fromCache, loadMs: Math.round(elapsed) });
    await warmUpKokoro();
  } catch {
    kokoro = null;
    useBrowser = true;
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - loadStartedAt;
    setRuntime({ phase: 'fallback', progress: 1, engine: 'webspeech', fromCache: false, warmed: false, loadMs: Math.round(elapsed) });
  }
}

async function loadKokoro(): Promise<{ engine: KokoroEngine; sawPartialProgress: boolean }> {
  const [{ KokoroTTS }, transformers] = await Promise.all([
    import('kokoro-js'),
    import('@huggingface/transformers'),
  ]);
  const env = transformers.env;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  try {
    env.backends.onnx.wasm.numThreads = 1;
    // Same-origin runtime so a school network does not also need the jsDelivr CDN.
    const origin = window.location.origin;
    env.backends.onnx.wasm.wasmPaths = {
      wasm: new URL(ortWasm, origin).href,
      mjs: new URL(ortWasmLoader, origin).href,
    };
  } catch {
    /* single-thread wasm is the default when the field is missing */
  }

  const files = new Map<string, { loaded: number; total: number }>();
  let sawPartialProgress = false;
  const engine = await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
    dtype: KOKORO_DTYPE,
    device: 'wasm',
    progress_callback: (info: { status?: string; file?: string; loaded?: number; total?: number }) => {
      if (info.status === 'progress') {
        const key = info.file || 'model';
        const total = info.total && info.total > 0 ? info.total : KOKORO_APPROX_BYTES;
        const loaded = info.loaded || 0;
        if (loaded > 0 && loaded < total) sawPartialProgress = true;
        files.set(key, { loaded, total });
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
  });
  return { engine, sawPartialProgress };
}

/** First Kokoro inference is slow even after download — burn one short generate. */
async function warmUpKokoro() {
  if (!kokoro || forceBasic) return;
  try {
    const voice = voiceForCallsign('AAL421') satisfies PilotVoice;
    // Tiny utterance; we discard audio (no play) so no gesture/AudioContext required.
    await withTimeout(kokoro.generate('Roger.', { voice, speed: 1 }), SLOW_GENERATE_MS);
    setRuntime({ warmed: true });
  } catch {
    /* warm-up failure is non-fatal; first spoken line may still be slow */
  }
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
      if (forceBasic || useBrowser || !kokoro || runtime.phase !== 'ready') {
        await speakBrowser(item.text, item.callsign, settings);
        continue;
      }
      const played = await speakNeural(item, settings);
      if (!played) {
        useBrowser = true;
        kokoro = null;
        setRuntime({ phase: 'fallback', progress: 1, engine: 'webspeech' });
        await speakBrowser(item.text, item.callsign, getVoiceSettings());
      }
    }
  } finally {
    draining = false;
    if (queue.length && getVoiceSettings().enabled) void drain();
  }
}

async function speakNeural(item: Utterance, settings: VoiceSettings): Promise<boolean> {
  if (!kokoro) return false;
  const voice = voiceForCallsign(item.callsign) satisfies PilotVoice;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      useBrowser = true;
      kokoro = null;
      setRuntime({ phase: 'fallback', progress: 1, engine: 'webspeech' });
      void speakBrowser(item.text, item.callsign, getVoiceSettings()).then(() => finish(true));
    }, SLOW_GENERATE_MS);

    kokoro.generate(item.text, { voice, speed: settings.rate }).then(
      async (audio) => {
        if (settled || !getVoiceSettings().enabled) {
          clearTimeout(timer);
          finish(true);
          return;
        }
        clearTimeout(timer);
        const samples = audio.audio;
        const rate = audio.sampling_rate || 24000;
        if (!samples || samples.length === 0) {
          finish(false);
          return;
        }
        await playSamples(samples, rate, getVoiceSettings());
        finish(true);
      },
      () => {
        clearTimeout(timer);
        finish(false);
      },
    );
  });
}

function playSamples(samples: Float32Array, sampleRate: number, settings: VoiceSettings): Promise<void> {
  unlockAudio();
  if (!audioCtx) return Promise.resolve();
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
  return new Promise((resolve) => {
    source.onended = () => resolve();
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

function browserVoice(callsign: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  if (voices.length === 0) return null;
  let hash = 0;
  for (let i = 0; i < callsign.length; i++) hash = (hash * 31 + callsign.charCodeAt(i)) >>> 0;
  return voices[hash % voices.length];
}

function speakBrowser(text: string, callsign: string, settings: VoiceSettings): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve();
  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    const voice = browserVoice(callsign);
    if (voice) utter.voice = voice;
    utter.rate = settings.rate;
    utter.volume = settings.volume;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
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

/** Test helper — reset module singletons between vitest cases. */
export function __resetPilotVoiceForTests() {
  runtime = { phase: 'idle', progress: 0, engine: 'none', fromCache: false, warmed: false, loadMs: 0 };
  kokoro = null;
  enginePromise = null;
  useBrowser = false;
  forceBasic = false;
  preloadStarted = false;
  queue.length = 0;
  draining = false;
}
