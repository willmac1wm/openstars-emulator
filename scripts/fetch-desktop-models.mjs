#!/usr/bin/env node
/**
 * Fetch Whisper + Kokoro assets for the desktop installer with checksum verification.
 * Models are written under src-tauri/resources/models/ (gitignored except README).
 *
 * Sources (official):
 * - Whisper ggml: https://huggingface.co/ggerganov/whisper.cpp
 * - Kokoro ONNX: https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
 */
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src-tauri/resources/models');
const WHISPER = join(OUT, 'whisper');
const KOKORO = join(OUT, 'kokoro');

/** Prefer quantized turbo; CI also fetches small/base for weak-CPU fallback. */
const WHISPER_FILES = [
  {
    name: 'ggml-large-v3-turbo-q5_0.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin',
    // Updated by CI when upstream changes — placeholder until first fetch records sha256.
    sha256: process.env.WHISPER_TURBO_Q5_SHA256 || '',
  },
  {
    name: 'ggml-small.en-q5_1.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin',
    sha256: process.env.WHISPER_SMALL_Q5_SHA256 || '',
  },
  {
    name: 'ggml-base.en-q5_1.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin',
    sha256: process.env.WHISPER_BASE_Q5_SHA256 || '',
  },
];

const KOKORO_BASE = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main';
const KOKORO_FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/model_quantized.onnx',
  'voices/am_michael.bin',
  'voices/am_fenrir.bin',
  'voices/am_puck.bin',
  'voices/af_bella.bin',
  'voices/af_nicole.bin',
  'voices/af_sarah.bin',
  'voices/am_echo.bin',
  'voices/af_sky.bin',
];

async function download(url, out, expectSha) {
  mkdirSync(dirname(out), { recursive: true });
  if (existsSync(out) && statSync(out).size > 1000) {
    if (expectSha) {
      const got = createHash('sha256').update(readFileSync(out)).digest('hex');
      if (got === expectSha) {
        console.log(`[desktop-models] skip ${out} (checksum ok)`);
        return;
      }
      console.warn(`[desktop-models] checksum mismatch for ${out}, re-fetching`);
    } else {
      console.log(`[desktop-models] skip existing ${out}`);
      return;
    }
  }
  console.log(`[desktop-models] fetching ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`Failed ${url}: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(out));
  const sha = createHash('sha256').update(readFileSync(out)).digest('hex');
  console.log(`[desktop-models] wrote ${out} (${statSync(out).size} bytes) sha256=${sha}`);
  if (expectSha && sha !== expectSha) {
    throw new Error(`Checksum failed for ${out}: got ${sha}, expected ${expectSha}`);
  }
  writeFileSync(`${out}.sha256`, `${sha}  ${out.split('/').pop()}\n`);
}

async function main() {
  mkdirSync(WHISPER, { recursive: true });
  mkdirSync(KOKORO, { recursive: true });
  writeFileSync(
    join(OUT, 'README.md'),
    '# Bundled models\n\nFetched by `npm run fetch-desktop-models`. Do not commit large binaries.\n',
  );

  for (const f of WHISPER_FILES) {
    await download(f.url, join(WHISPER, f.name), f.sha256 || undefined);
  }
  for (const rel of KOKORO_FILES) {
    await download(`${KOKORO_BASE}/${rel}`, join(KOKORO, rel), undefined);
  }
  console.log('[desktop-models] done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
