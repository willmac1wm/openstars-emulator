import { PilotVoice, voiceForCallsign } from './phraseology';
import { getVoiceSettings, VoiceSettings } from './voiceSettings';
// Deep package exports hide these files. Importing the installed paths lets Vite
// emit them as same-origin assets instead of fetching the runtime from a CDN.
import ortWasm from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import ortWasmLoader from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url';

export const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

/** q8 maps to onnx/model_quantized.onnx in Transformers.js (about 92 MB). */
export const KOKORO_DTYPE = 'q8' as const;

const LOAD_TIMEOUT_MS = 90_000;
const SLOW_GENERATE_MS = 8_000;

export type VoicePhase = 'idle' | 'loading' | 'ready' | 'fallback';

export interface VoiceRuntime {
  phase: VoicePhase;
  /** 0–1 while the neural model is downloading. */
  progress: number;
  engine: 'none' | 'kokoro' | 'webspeech';
}

type KokoroModule = typeof import('kokoro-js');
type KokoroEngine = InstanceType<KokoroModule['KokoroTTS']>;

let runtime: VoiceRuntime = { phase: 'idle', progress: 0, engine: 'none' };
const runtimeListeners = new Set<() => void>();

let audioCtx: AudioContext | null = null;
let kokoro: KokoroEngine | null = null;
let enginePromise: Promise<void> | null = null;
let useBrowser = false;

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

export function unlockAudio() {
  if (typeof window === 'undefined') return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
}

/** Call from a click or keypress. Downloads the neural voice only after that gesture. */
export function primePilotVoice() {
  unlockAudio();
  if (!getVoiceSettings().enabled) return;
  void ensureEngine();
}

export function speakPilot(text: string, callsign: string) {
  if (!text || !getVoiceSettings().enabled) return;
  primePilotVoice();
  queue.push({ text, callsign });
  void drain();
}

function ensureEngine(): Promise<void> {
  if (!enginePromise) enginePromise = initEngine();
  return enginePromise;
}

async function initEngine() {
  setRuntime({ phase: 'loading', progress: 0, engine: 'none' });
  try {
    kokoro = await withTimeout(loadKokoro(), LOAD_TIMEOUT_MS);
    useBrowser = false;
    setRuntime({ phase: 'ready', progress: 1, engine: 'kokoro' });
  } catch {
    kokoro = null;
    useBrowser = true;
    setRuntime({ phase: 'fallback', progress: 1, engine: 'webspeech' });
  }
}

async function loadKokoro(): Promise<KokoroEngine> {
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
  return KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
    dtype: KOKORO_DTYPE,
    device: 'wasm',
    progress_callback: (info) => {
      if (info.status !== 'progress' || !info.total) return;
      const key = info.file || 'model';
      files.set(key, { loaded: info.loaded || 0, total: info.total });
      let loaded = 0;
      let total = 0;
      for (const file of files.values()) {
        loaded += file.loaded;
        total += file.total;
      }
      if (total > 0) setRuntime({ phase: 'loading', progress: Math.min(1, loaded / total) });
    },
  });
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
      await ensureEngine();
      if (!useBrowser && kokoro) {
        const played = await speakNeural(item, settings);
        if (!played) {
          useBrowser = true;
          kokoro = null;
          setRuntime({ phase: 'fallback', progress: 1, engine: 'webspeech' });
          await speakBrowser(item.text, item.callsign, getVoiceSettings());
        }
      } else {
        await speakBrowser(item.text, item.callsign, settings);
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
