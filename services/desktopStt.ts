/**
 * Desktop STT bridge: capture mic PCM while PTT is held, send to native Whisper,
 * then feed the transcript into the existing ATC post-processor.
 */
import { invokeDesktop, isDesktopApp } from './desktop';
import type { SpeechResultPayload } from './speechRecognition';

export interface DesktopSttStatus {
  ready: boolean;
  modelId: string;
  backend: string;
  lastBenchmarkMs: number;
  availableModels: string[];
}

export interface DesktopSttResult {
  text: string;
  alternatives: string[];
  latencyMs: number;
  modelId: string;
}

let mediaStream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
let chunks: Float32Array[] = [];
let capturing = false;

const TARGET_SR = 16_000;

function downsample(input: Float32Array, inRate: number): Float32Array {
  if (inRate === TARGET_SR) return input;
  const ratio = inRate / TARGET_SR;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    out[i] = input[Math.floor(i * ratio)] ?? 0;
  }
  return out;
}

function f32ToBase64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    view.setFloat32(i * 4, samples[i], true);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function initDesktopStt(): Promise<DesktopSttStatus | null> {
  if (!isDesktopApp()) return null;
  try {
    return await invokeDesktop<DesktopSttStatus>('stt_init');
  } catch {
    return null;
  }
}

export async function getDesktopSttStatus(): Promise<DesktopSttStatus | null> {
  if (!isDesktopApp()) return null;
  try {
    return await invokeDesktop<DesktopSttStatus>('stt_status');
  } catch {
    return null;
  }
}

export async function startDesktopCapture(): Promise<void> {
  if (!isDesktopApp() || capturing) return;
  chunks = [];
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(mediaStream);
  // ScriptProcessor is deprecated but widely available offline; keep buffer modest.
  processor = audioCtx.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (ev) => {
    if (!capturing) return;
    const input = ev.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
  };
  // Keep the graph alive without monitoring the mic through speakers.
  const mute = audioCtx.createGain();
  mute.gain.value = 0;
  source.connect(processor);
  processor.connect(mute);
  mute.connect(audioCtx.destination);
  capturing = true;
}

export async function stopDesktopCaptureAndTranscribe(
  initialPrompt: string,
): Promise<SpeechResultPayload | null> {
  if (!isDesktopApp()) return null;
  capturing = false;
  const inRate = audioCtx?.sampleRate ?? 48000;
  try {
    processor?.disconnect();
    mediaStream?.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
  processor = null;
  mediaStream = null;
  if (audioCtx) {
    void audioCtx.close();
    audioCtx = null;
  }

  if (!chunks.length) {
    return {
      transcript: '',
      alternatives: [],
      isFinal: true,
    };
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.length;
  }
  chunks = [];
  const pcm16 = downsample(merged, inRate);
  const pcmB64 = f32ToBase64(pcm16);

  const result = await invokeDesktop<DesktopSttResult>('stt_transcribe', {
    pcmB64,
    initialPrompt,
  });

  const alts = (result.alternatives?.length ? result.alternatives : [result.text])
    .filter(Boolean)
    .map((t) => ({ transcript: t, confidence: 0.85 }));

  return {
    transcript: result.text,
    alternatives: alts,
    isFinal: true,
  };
}

/** Build Whisper initial_prompt from ATC vocab + live callsigns. */
export function buildAtcInitialPrompt(callsigns: string[]): string {
  const base =
    'Air traffic control radio. United American Delta Southwest. '
    + 'Turn left heading, turn right heading, climb and maintain, descend and maintain, '
    + 'reduce speed, increase speed, knots, thousand, niner, flight level.';
  const cs = callsigns.slice(0, 12).join(' ');
  return cs ? `${base} Active aircraft: ${cs}.` : base;
}
