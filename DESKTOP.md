# OpenSTARS Desktop (Tauri v2)

Offline Mac + Windows installer for classroom / STEM expo booths. Same React scope as the web app; speech recognition and model packaging differ.

## What ships offline

| Piece | Implementation | License |
| --- | --- | --- |
| UI / sim | Existing Vite + React build (`VITE_OPENSTARS_DESKTOP=1`) | project |
| STT | Native **whisper.cpp** via `whisper-rs` | MIT |
| Whisper weights | `large-v3-turbo` quantized → `small.en` → `base.en` fallback | MIT (ggml ports) |
| TTS | Kokoro-82M ONNX in the webview (`kokoro-js`) | Apache-2.0 |
| Phonemizer (desktop) | OpenSTARS **ATC G2P** lexicon (`services/atcG2p.ts`) via Vite alias — **eSpeak NG is not bundled** | Apache-2.0 |
| Analytics | Disabled / no PostHog in desktop path | — |

Publisher string: **OpenSTARS**. No accounts, no PII collection, no cloud STT/TTS.

## Dev

```bash
# Optional: fetch Whisper + Kokoro assets into src-tauri/resources/models/
npm run fetch-desktop-models

# Dev shell (Vite + Tauri)
npm run tauri:dev

# Release bundle (local)
npm run tauri:build
```

Requires Rust stable, platform WebView deps, and (for model fetch) network access to Hugging Face.

## Speech recognition

- PTT captures PCM in the webview → base64 f32 LE mono 16 kHz → `stt_transcribe`.
- Whisper `initial_prompt` biases ATC verbs + live callsigns (`buildAtcInitialPrompt`).
- Transcripts reuse the web ATC post-processor (`parseBestSpokenClearance`).
- Startup bench picks turbo vs small/base when wall time looks weak (>~700 ms on a 1 s sine).

## Pilot voices

Desktop Vite builds alias `phonemizer` → `services/phonemizerDesktopShim.ts` so kokoro-js never loads the eSpeak NG WASM worker. The web build keeps the default phonemizer.

## CI / Releases

Workflow: `.github/workflows/desktop-release.yml`

- Triggers on `desktop-v*` tags or `workflow_dispatch`.
- Builds macOS (arm64 + x64) and Windows; publishes GitHub Release assets.
- Web menu **Download** (`components/DesktopDownload.tsx`) points at tag `desktop-v0.1.0`.

### Signing (optional — secrets only, never commit values)

**Apple Team ID (public):** `Y6P8GK8M2N`

| Secret | Purpose |
| --- | --- |
| `APPLE_CERTIFICATE` | base64 `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | p12 password |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: …` |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | notarization |
| `WINDOWS_CERTIFICATE` | base64 `.pfx` |
| `WINDOWS_CERTIFICATE_PASSWORD` | pfx password |

If secrets are absent, CI still ships **unsigned** builds. Expect Gatekeeper / SmartScreen warnings until Will adds signing material.

## Latency expectations

| Path | Target |
| --- | --- |
| Whisper after warm (turbo, Metal/Vulkan) | sub-second for short clearances |
| First PTT (cold) | higher — STT warm runs at app launch |
| Kokoro chunk | same webview ONNX path as web; G2P is lexicon lookup (cheap) |

Exact numbers depend on machine; Desktop Settings shows the startup Whisper bench ms.

## Will actions

1. Merge this PR.
2. Tag `desktop-v0.1.0` (or run the Desktop Release workflow) after models fetch succeeds in CI.
3. Add Apple/Windows signing secrets when ready for Gatekeeper-clean / SmartScreen-clean installers.
4. Confirm expo machines meet minimums (macOS 11+, Windows 10+ with WebView2).
