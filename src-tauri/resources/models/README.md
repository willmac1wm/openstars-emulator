# Desktop models

Whisper ggml weights are **not** sealed inside the macOS `.app` (deep codesign of
hundreds of MB hung aarch64 CI). Signed builds download them on first launch into
the app data directory (`~/Library/Application Support/…/models` on Mac).

For local/dev offline bundles:

```bash
npm run fetch-desktop-models
```

That writes under `src-tauri/resources/models/` (gitignored binaries):

- `whisper/` — ggml large-v3-turbo / small.en / base.en (MIT)
- `kokoro/` — optional ONNX copies (desktop TTS still uses the webview Kokoro path)

CI refuses to ship `*.bin` / `*.onnx` under `resources/` so codesign stays fast.
