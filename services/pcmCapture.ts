/**
 * Shared mic capture → 16 kHz mono Float32 PCM for Whisper (web + desktop patterns).
 */

const TARGET_SR = 16_000;

export function downsamplePcm(input: Float32Array, inRate: number): Float32Array {
  if (inRate === TARGET_SR) return input;
  const ratio = inRate / TARGET_SR;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / (end - start);
  }
  return out;
}

export interface PcmCaptureSession {
  start: () => Promise<void>;
  /** Stop mic and return 16 kHz mono PCM (empty if nothing captured). */
  stop: () => Promise<Float32Array>;
}

export function createPcmCapture(): PcmCaptureSession {
  let mediaStream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let chunks: Float32Array[] = [];
  let capturing = false;
  let cancelled = false;

  const ensurePipeline = async () => {
    const alive = mediaStream?.getAudioTracks().some((t) => t.readyState === 'live');
    if (alive && audioCtx && processor) {
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => undefined);
      }
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    if (cancelled) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    mediaStream = stream;
    audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => undefined);
    }
    const source = audioCtx.createMediaStreamSource(mediaStream);
    processor = audioCtx.createScriptProcessor(2048, 1, 1);
    processor.onaudioprocess = (ev) => {
      if (!capturing) return;
      const input = ev.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(input));
    };
    const mute = audioCtx.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(audioCtx.destination);
  };

  return {
    async start() {
      if (capturing) return;
      cancelled = false;
      chunks = [];
      await ensurePipeline();
      if (!cancelled) capturing = true;
    },
    async stop() {
      cancelled = true;
      capturing = false;
      const inRate = audioCtx?.sampleRate ?? 48_000;
      if (!chunks.length) return new Float32Array(0);
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const merged = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        merged.set(c, off);
        off += c.length;
      }
      chunks = [];
      return downsamplePcm(merged, inRate);
    },
  };
}
