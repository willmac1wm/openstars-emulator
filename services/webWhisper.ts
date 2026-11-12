/**
 * Opt-in Accurate speech (beta): in-browser Whisper via @huggingface/transformers.
 * Same-origin weights under /voice/onnx-community/whisper-tiny.en/ (MIT/Apache).
 * Prefers WebGPU; falls back silently to Web Speech when unavailable / not ready / slow.
 */
import { applyTransformersVoiceEnv, registerVoiceServiceWorker, requestPersistentStorage } from './voiceAssets';
import { buildAtcInitialPrompt } from './atcPrompt';
import { createPcmCapture, PcmCaptureSession } from './pcmCapture';
import type { SpeechResultPayload } from './speechRecognition';
import ortWasm from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import ortWasmLoader from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url';

export type WebWhisperPhase = 'off' | 'unsupported' | 'loading' | 'ready' | 'error';

export interface WebWhisperRuntime {
  phase: WebWhisperPhase;
  progress: number;
  device: 'webgpu' | 'wasm' | null;
  modelId: string;
  lastLatencyMs: number;
  approxBytes: number;
  error?: string;
}

const MODEL_ID = 'onnx-community/whisper-tiny.en';
/** Encoder q8 (~10MB) + decoder merged q8 (~30MB) + tokenizer. */
export const WHISPER_APPROX_BYTES = 45_000_000;
const LOAD_TIMEOUT_MS = 120_000;
const TRANSCRIBE_BUDGET_MS = 8_000;

type AsrPipeline = (
  audio: Float32Array | string,
  opts?: Record<string, unknown>,
) => Promise<{ text?: string } | Array<{ text?: string }>>;

let pipeline: AsrPipeline | null = null;
let loadPromise: Promise<boolean> | null = null;
let capture: PcmCaptureSession | null = null;

let runtime: WebWhisperRuntime = {
  phase: 'off',
  progress: 0,
  device: null,
  modelId: MODEL_ID,
  lastLatencyMs: 0,
  approxBytes: WHISPER_APPROX_BYTES,
};

type Listener = (rt: WebWhisperRuntime) => void;
const listeners = new Set<Listener>();

function setRuntime(partial: Partial<WebWhisperRuntime>) {
  runtime = { ...runtime, ...partial };
  listeners.forEach((l) => l(runtime));
}

export function getWebWhisperRuntime(): WebWhisperRuntime {
  return runtime;
}

export function subscribeWebWhisper(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function webGpuAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu?.requestAdapter) return false;
  try {
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Start background download/warm when Accurate speech is enabled. */
export function ensureWebWhisperLoading(): void {
  if (runtime.phase === 'ready' || runtime.phase === 'loading') return;
  if (loadPromise) return;
  void warmWebWhisper();
}

export async function warmWebWhisper(): Promise<boolean> {
  if (pipeline && runtime.phase === 'ready') return true;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    setRuntime({ phase: 'loading', progress: 0.02, error: undefined });
    void registerVoiceServiceWorker();
    void requestPersistentStorage();

    const hasGpu = await webGpuAvailable();
    if (!hasGpu) {
      setRuntime({ phase: 'unsupported', progress: 0, device: null, error: 'WebGPU unavailable' });
      return false;
    }

    try {
      const transformers = await import('@huggingface/transformers');
      applyTransformersVoiceEnv(transformers.env);
      try {
        const origin = window.location.origin;
        transformers.env.backends.onnx.wasm.wasmPaths = {
          wasm: new URL(ortWasm, origin).href,
          mjs: new URL(ortWasmLoader, origin).href,
        };
      } catch {
        /* default wasm paths */
      }

      // Avoid TS2590 on transformers.pipeline's enormous return union.
      const loadPipeline = transformers.pipeline as (
        task: string,
        model: string,
        options?: Record<string, unknown>,
      ) => Promise<AsrPipeline>;
      const asr = await withTimeout(
        loadPipeline('automatic-speech-recognition', MODEL_ID, {
          device: 'webgpu',
          dtype: 'q8',
          progress_callback: (info: { status?: string; loaded?: number; total?: number }) => {
            if (info.status === 'progress' && info.total && info.total > 0) {
              setRuntime({
                phase: 'loading',
                progress: Math.min(0.99, (info.loaded || 0) / info.total),
              });
            }
          },
        }),
        LOAD_TIMEOUT_MS,
        'Whisper load',
      );

      pipeline = asr;
      setRuntime({ phase: 'ready', progress: 1, device: 'webgpu' });
      return true;
    } catch (err) {
      pipeline = null;
      setRuntime({
        phase: 'error',
        progress: 0,
        device: null,
        error: err instanceof Error ? err.message : 'Whisper load failed',
      });
      return false;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export function isWebWhisperReady(): boolean {
  return runtime.phase === 'ready' && Boolean(pipeline);
}

export async function startWebWhisperCapture(): Promise<void> {
  if (!capture) capture = createPcmCapture();
  await capture.start();
}

export async function stopWebWhisperAndTranscribe(callsigns: string[]): Promise<SpeechResultPayload | null> {
  if (!capture) return null;
  const pcm = await capture.stop();
  if (!pcm.length) {
    return { transcript: '', alternatives: [], isFinal: true };
  }
  if (!isWebWhisperReady() || !pipeline) return null;

  const prompt = buildAtcInitialPrompt(callsigns);
  const t0 = performance.now();
  try {
    // transformers.js WhisperFeatureExtractor expects a raw Float32Array @ 16 kHz.
    // tiny.en is English-only — do not pass language/task (rejected by generate()).
    const result = await withTimeout(
      pipeline(pcm, {
        return_timestamps: false,
        // Bias decoding toward ATC phraseology + live callsigns (no audio leaves device).
        initial_prompt: prompt,
      }),
      TRANSCRIBE_BUDGET_MS,
      'Whisper transcribe',
    );
    const text = Array.isArray(result) ? (result[0]?.text || '') : (result.text || '');
    const cleaned = text.trim();
    const latency = Math.round(performance.now() - t0);
    setRuntime({ lastLatencyMs: latency });
    return {
      transcript: cleaned,
      alternatives: cleaned ? [{ transcript: cleaned, confidence: 0.88 }] : [],
      isFinal: true,
    };
  } catch {
    setRuntime({ lastLatencyMs: Math.round(performance.now() - t0) });
    return null;
  }
}

/** Disable Accurate speech — abort in-flight capture; keep cached weights. */
export function resetWebWhisperToOff(): void {
  setRuntime({ phase: 'off', progress: 0, error: undefined });
}
