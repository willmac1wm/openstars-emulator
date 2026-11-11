# Self-hosted Kokoro voice assets

Populated by `npm run fetch-voice` (also runs as `prebuild`).

Path layout matches Hugging Face model id so transformers.js can load with:

```
env.allowLocalModels = true
env.localModelPath = '/voice/'
```

Do not commit the large `.onnx` binary — Vercel/build downloads it.
