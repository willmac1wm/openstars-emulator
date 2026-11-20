/**
 * Fast cloud ATC speech-to-text client (/api/transcribe on Vercel).
 *
 * Uses MediaRecorder (tiny ~5 KB Opus/MP4 audio clip) with a warm mic stream
 * for zero-lag PTT start, plus a live audio level meter so controllers can see
 * immediately that their microphone is picking up audio.
 */
import type { SpeechResultPayload } from './speechRecognition';

export type CloudSttProvider = 'groq' | 'deepgram' | 'gemini' | null;

export interface CloudSttRuntime {
  checked: boolean;
  available: boolean;
  provider: CloudSttProvider;
  lastLatencyMs: number;
  error?: string;
}

let runtime: CloudSttRuntime = {
  checked: false,
  available: false,
  provider: null,
  lastLatencyMs: 0,
};

type Listener = (rt: CloudSttRuntime) => void;
const listeners = new Set<Listener>();

function setRuntime(partial: Partial<CloudSttRuntime>) {
  runtime = { ...runtime, ...partial };
  listeners.forEach((l) => l(runtime));
}

export function getCloudSttRuntime(): CloudSttRuntime {
  return runtime;
}

export function subscribeCloudStt(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let probePromise: Promise<boolean> | null = null;

/** Check once whether /api/transcribe has an API key configured on the server. */
export function probeCloudStt(): Promise<boolean> {
  if (runtime.checked) return Promise.resolve(runtime.available);
  if (probePromise) return probePromise;
  if (typeof fetch === 'undefined' || typeof window === 'undefined') {
    setRuntime({ checked: true, available: false, provider: null });
    return Promise.resolve(false);
  }
  probePromise = fetch('/api/transcribe', { method: 'GET' })
    .then(async (res) => {
      if (!res.ok) return { available: false, provider: null };
      const data = await res.json().catch(() => ({ available: false, provider: null }));
      return {
        available: Boolean(data?.available),
        provider: (data?.provider ?? null) as CloudSttProvider,
      };
    })
    .catch(() => ({ available: false, provider: null as CloudSttProvider }))
    .then((info) => {
      setRuntime({ checked: true, available: info.available, provider: info.provider });
      return info.available;
    })
    .finally(() => {
      probePromise = null;
    });
  return probePromise;
}

export function isCloudSttAvailable(): boolean {
  return runtime.checked && runtime.available;
}

// --- Warm MediaRecorder + live mic level meter ---
let warmStream: MediaStream | null = null;
let levelCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let levelRaf: number | null = null;
let recorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let recordedMime = 'audio/webm';
let captureCancelled = false;

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

async function ensureWarmStream(): Promise<MediaStream> {
  const alive = warmStream?.getAudioTracks().some((t) => t.readyState === 'live');
  if (alive && warmStream) return warmStream;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  warmStream = stream;
  try {
    levelCtx = new AudioContext();
    const src = levelCtx.createMediaStreamSource(stream);
    analyser = levelCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
  } catch {
    analyser = null;
  }
  return stream;
}

function stopLevelMeter() {
  if (levelRaf !== null) {
    cancelAnimationFrame(levelRaf);
    levelRaf = null;
  }
}

function startLevelMeter(onLevel?: (level: number) => void) {
  stopLevelMeter();
  if (!analyser || !onLevel) return;
  const data = new Uint8Array(analyser.fftSize);
  const tick = () => {
    if (!analyser) return;
    analyser.getByteTimeDomainData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    onLevel(Math.min(1, peak * 2.5));
    levelRaf = requestAnimationFrame(tick);
  };
  levelRaf = requestAnimationFrame(tick);
}

export async function startCloudSttCapture(onLevel?: (level: number) => void): Promise<void> {
  captureCancelled = false;
  recordedChunks = [];
  const stream = await ensureWarmStream();
  if (captureCancelled) return;
  if (levelCtx?.state === 'suspended') {
    void levelCtx.resume().catch(() => undefined);
  }
  const mime = pickMimeType();
  recordedMime = mime || 'audio/webm';
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  rec.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data);
  };
  recorder = rec;
  rec.start(100);
  startLevelMeter(onLevel);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to encode audio'));
    reader.readAsDataURL(blob);
  });
}

export async function stopCloudSttAndTranscribe(
  callsigns: string[],
): Promise<SpeechResultPayload | null> {
  captureCancelled = true;
  stopLevelMeter();
  const rec = recorder;
  recorder = null;
  if (!rec) return null;

  const blob = await new Promise<Blob>((resolve) => {
    const finalize = () => resolve(new Blob(recordedChunks, { type: recordedMime }));
    if (rec.state === 'inactive') {
      finalize();
      return;
    }
    rec.onstop = finalize;
    try {
      rec.stop();
    } catch {
      finalize();
    }
  });
  recordedChunks = [];

  if (blob.size < 400) {
    return { transcript: '', alternatives: [], isFinal: true };
  }

  const t0 = performance.now();
  try {
    const audioBase64 = await blobToBase64(blob);
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        mimeType: recordedMime,
        callsigns,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const latency = Math.round(performance.now() - t0);
    if (!res.ok) {
      setRuntime({ lastLatencyMs: latency, error: data?.error || `HTTP ${res.status}` });
      return null;
    }
    const transcript = String(data?.transcript || '').trim();
    setRuntime({ lastLatencyMs: latency, error: undefined });
    return {
      transcript,
      alternatives: transcript ? [{ transcript, confidence: 0.94 }] : [],
      isFinal: true,
    };
  } catch (err) {
    setRuntime({
      lastLatencyMs: Math.round(performance.now() - t0),
      error: err instanceof Error ? err.message : 'Network error',
    });
    return null;
  }
}
