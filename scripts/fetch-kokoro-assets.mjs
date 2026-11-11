#!/usr/bin/env node
/**
 * Download Kokoro ONNX (q8) + used voice bins into public/voice for same-origin serving.
 * Run on Vercel/build and locally so transformers.js does not hit HF CDN redirects
 * (those often fail to populate the Cache API).
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'public/voice/onnx-community/Kokoro-82M-v1.0-ONNX');
const BASE = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main';

const FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/model_quantized.onnx',
  // Pilot voices (instructor uses af_bella)
  'voices/am_michael.bin',
  'voices/am_fenrir.bin',
  'voices/am_puck.bin',
  'voices/af_bella.bin',
  'voices/af_nicole.bin',
  'voices/af_sarah.bin',
  'voices/am_echo.bin',
  'voices/af_sky.bin',
];

async function download(rel) {
  const out = join(DEST, rel);
  mkdirSync(dirname(out), { recursive: true });
  if (existsSync(out) && statSync(out).size > 0) {
    // Skip if present (local/dev rebuild). Model must be ~80MB+.
    if (!rel.endsWith('.onnx') || statSync(out).size > 50_000_000) {
      console.log(`[kokoro] skip existing ${rel} (${statSync(out).size} bytes)`);
      return;
    }
  }
  const url = `${BASE}/${rel}`;
  console.log(`[kokoro] fetching ${rel}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`Failed ${url}: ${res.status}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(out));
  console.log(`[kokoro] wrote ${rel} (${statSync(out).size} bytes)`);
}

async function main() {
  mkdirSync(DEST, { recursive: true });
  for (const file of FILES) {
    await download(file);
  }
  console.log('[kokoro] assets ready under public/voice/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
