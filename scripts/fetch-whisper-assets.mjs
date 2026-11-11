#!/usr/bin/env node
/**
 * Download Whisper tiny.en (q8 ONNX) into public/voice for same-origin Accurate speech.
 * Apache-2.0 / MIT stack via onnx-community + transformers.js.
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'public/voice/onnx-community/whisper-tiny.en');
const BASE = 'https://huggingface.co/onnx-community/whisper-tiny.en/resolve/main';

const FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'added_tokens.json',
  'normalizer.json',
  'merges.txt',
  'vocab.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];

async function download(rel) {
  const out = join(DEST, rel);
  mkdirSync(dirname(out), { recursive: true });
  if (existsSync(out) && statSync(out).size > 1024) {
    console.log(`[whisper] skip existing ${rel} (${statSync(out).size} bytes)`);
    return;
  }
  const url = `${BASE}/${rel}`;
  console.log(`[whisper] fetching ${rel}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`Failed ${url}: ${res.status}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(out));
  console.log(`[whisper] wrote ${rel} (${statSync(out).size} bytes)`);
}

async function main() {
  mkdirSync(DEST, { recursive: true });
  for (const file of FILES) {
    await download(file);
  }
  console.log('[whisper] assets ready under public/voice/onnx-community/whisper-tiny.en/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
