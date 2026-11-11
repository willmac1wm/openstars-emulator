# Self-hosted voice + STT assets

Populated by `npm run fetch-voice` (Kokoro TTS) and `npm run fetch-whisper` (Whisper tiny.en).
Both run as `prebuild`.

Path layout matches Hugging Face model ids so transformers.js can load with:

```
env.allowLocalModels = true
env.localModelPath = '/voice/'
```

- `onnx-community/Kokoro-82M-v1.0-ONNX/` — pilot / instructor TTS (Apache-2.0)
- `onnx-community/whisper-tiny.en/` — Accurate speech (beta) ASR, q8 ONNX (~45 MB, MIT/Apache)

Do not commit the large `.onnx` binaries — Vercel/build downloads them.
Cached in the browser by `/voice-sw.js`.
