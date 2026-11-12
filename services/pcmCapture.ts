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
    out[i] = input[Math.floor(i * ratio)] ?? 0;
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

  return {
    async start() {
      if (capturing) return;
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
      processor = audioCtx.createScriptProcessor(4096, 1, 1);
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
      capturing = true;
    },
    async stop() {
      capturing = false;
      const inRate = audioCtx?.sampleRate ?? 48_000;
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
