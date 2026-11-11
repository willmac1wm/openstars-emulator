import ortWasm from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import ortWasmLoader from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url';

const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const KOKORO_DTYPE = 'q8' as const;
const KOKORO_APPROX_BYTES = 92_361_116;
const STALL_TIMEOUT_MS = 20_000;
const TOTAL_LOAD_TIMEOUT_MS = 120_000;

type KokoroModule = typeof import('kokoro-js');
type KokoroEngine = InstanceType<KokoroModule['KokoroTTS']>;

let kokoro: KokoroEngine | null = null;
let loadedDevice: 'wasm' | 'webgpu' = 'wasm';
let initPromise: Promise<void> | null = null;

async function webGpuAvailable(): Promise<boolean> {
  const gpu = (self as unknown as { navigator?: { gpu?: { requestAdapter: () => Promise<unknown> } } }).navigator?.gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
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
      (val) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(val);
      },
      (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      },
    );
  });
}

async function initKokoro() {
  const [{ KokoroTTS }, transformers] = await Promise.all([
    import('kokoro-js'),
    import('@huggingface/transformers'),
  ]);
  const env = transformers.env;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  try {
    const canThread = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 1;
    env.backends.onnx.wasm.numThreads = canThread ? Math.min(4, Math.max(1, cores)) : 1;
    const origin = self.location.origin;
    env.backends.onnx.wasm.wasmPaths = {
      wasm: new URL(ortWasm, origin).href,
      mjs: new URL(ortWasmLoader, origin).href,
    };
  } catch {
    /* fallback to default wasm config */
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

      const engine = await withActivityTimeout(
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
                  self.postMessage({
                    type: 'progress',
                    progress: Math.min(0.99, sumLoaded / sumTotal),
                  });
                }
              } else if (info.status === 'ready' || info.status === 'done') {
                self.postMessage({ type: 'progress', progress: 0.95 });
              }
            },
          }),
        STALL_TIMEOUT_MS,
        TOTAL_LOAD_TIMEOUT_MS,
      );

      kokoro = engine;
      loadedDevice = attempt.device;
      self.postMessage({
        type: 'loaded',
        device: loadedDevice,
        sawPartialProgress,
      });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Kokoro failed to load in worker');
}

// Serialize synthesis inside the worker; high-priority requests jump ahead of prewarm requests.
interface SynthJob {
  id: number;
  text: string;
  voice: string;
  speed: number;
  priority: 'high' | 'low';
}

const jobQueue: SynthJob[] = [];
let working = false;

async function processQueue() {
  if (working || !kokoro) return;
  working = true;
  try {
    while (jobQueue.length > 0) {
      const job = jobQueue.shift()!;
      try {
        const audio = await kokoro.generate(job.text, {
          voice: job.voice as Parameters<KokoroEngine['generate']>[1] extends { voice?: infer V } ? V : never,
          speed: job.speed,
        });
        const samples = new Float32Array(audio.audio);
        const sampleRate = audio.sampling_rate || 24000;
        self.postMessage(
          {
            type: 'generated',
            id: job.id,
            samples,
            sampleRate,
          },
          { transfer: [samples.buffer] },
        );
      } catch (err) {
        self.postMessage({
          type: 'error',
          id: job.id,
          error: String(err),
        });
      }
    }
  } finally {
    working = false;
  }
}

self.onmessage = (event: MessageEvent) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'init') {
    if (!initPromise) {
      initPromise = initKokoro().catch((err) => {
        initPromise = null;
        self.postMessage({ type: 'init_error', error: String(err) });
      });
    }
    return;
  }

  if (msg.type === 'generate') {
    const job: SynthJob = {
      id: msg.id,
      text: msg.text,
      voice: msg.voice,
      speed: msg.speed || 1,
      priority: msg.priority === 'low' ? 'low' : 'high',
    };
    if (job.priority === 'high') {
      // Insert before any low-priority prewarm jobs
      const firstLowIdx = jobQueue.findIndex((j) => j.priority === 'low');
      if (firstLowIdx === -1) {
        jobQueue.push(job);
      } else {
        jobQueue.splice(firstLowIdx, 0, job);
      }
    } else {
      // Cap low-priority prewarm backlog so it never builds up
      const lowCount = jobQueue.filter((j) => j.priority === 'low').length;
      if (lowCount < 16) {
        jobQueue.push(job);
      } else {
        self.postMessage({ type: 'error', id: job.id, error: 'prewarm_skipped' });
        return;
      }
    }
    void processQueue();
  }
};
