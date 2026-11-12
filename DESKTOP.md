# OpenSTARS Desktop (Tauri v2)

Offline Mac + Windows installer for classroom / STEM expo booths. Same React scope as the web app; speech recognition and model packaging differ.

## What ships offline

| Piece | Implementation | License |
| --- | --- | --- |
| UI / sim | Existing Vite + React build (`VITE_OPENSTARS_DESKTOP=1`) | project |
| STT | Native **whisper.cpp** via `whisper-rs` | MIT |
| Whisper weights | First-launch download into app data (`large-v3-turbo` → `small.en` → `base.en`); optional local bundle via `fetch-desktop-models` | MIT (ggml ports) |
| TTS | Kokoro-82M ONNX in the webview (`kokoro-js`) | Apache-2.0 |
| Phonemizer (desktop) | OpenSTARS **ATC G2P** lexicon (`services/atcG2p.ts`) via Vite alias — **eSpeak NG is not bundled** | Apache-2.0 |
| Analytics | Disabled / no PostHog in desktop path | — |

Publisher string: **OpenSTARS**. No accounts, no PII collection, no cloud STT/TTS.

## Dev

```bash
# Optional offline bundle for local/dev (not used in signed CI builds):
npm run fetch-desktop-models

# Dev shell (Vite + Tauri)
npm run tauri:dev

# Release bundle (local)
npm run tauri:build
```

Requires Rust stable, platform WebView deps, and network access to Hugging Face on **first launch** (or when running `fetch-desktop-models`).

### Why models are outside the sealed `.app`

Apple deep codesign of ~900MB Whisper/Kokoro resources hung aarch64 release jobs for hours. Release builds therefore ship a slim `.app`; Whisper ggml files download once into app data. Pre-seed for fully offline expo machines by copying `whisper/*.bin` into the app data `models/whisper/` folder before first launch.

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
- Web menu **Download** (`components/DesktopDownload.tsx`) points at tag `desktop-v0.1.1` (Apple Silicon falls back to `desktop-v0.1.0` aarch64 until a signed arm64 build exists).
- Mac jobs (aarch64 + x64) pass Apple secrets into `tauri-action`, then verify with `codesign --verify --deep --strict`, `spctl -a -vvv -t install`, and `xcrun stapler validate` (logged; secret values never printed).
- CI guards against `*.bin` / `*.onnx` under `src-tauri/resources` so sealed codesign stays fast.

### Signing (secrets only — never commit values)

**Apple Team ID (public):** `Y6P8GK8M2N`

| Secret | Purpose |
| --- | --- |
| `APPLE_CERTIFICATE` | base64 `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | p12 password |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: WILLIAM ERNEST MACOMBER (Y6P8GK8M2N)` |
| `APPLE_ID` / `APPLE_PASSWORD` (app-specific) / `APPLE_TEAM_ID` | notarization |
| `WINDOWS_CERTIFICATE` | base64 `.pfx` (optional; Windows stays unsigned without it) |
| `WINDOWS_CERTIFICATE_PASSWORD` | pfx password |

With Apple secrets present, Mac DMGs are Developer ID signed, notarized, and stapled. Windows remains unsigned until Authenticode secrets are added.

## Latency expectations

| Path | Target |
| --- | --- |
| Whisper after warm (turbo, Metal/Vulkan) | sub-second for short clearances |
| First PTT (cold) | higher — STT warm runs at app launch |
| Kokoro chunk | same webview ONNX path as web; G2P is lexicon lookup (cheap) |

Exact numbers depend on machine; Desktop Settings shows the startup Whisper bench ms.

## Will actions

1. Keep Apple signing secrets in GitHub Actions (already set for Developer ID + notarization).
2. Tag `desktop-v0.1.1` (or run Desktop Release workflow_dispatch) to publish signed Mac DMGs.
3. Add Windows Authenticode secrets when ready for SmartScreen-clean installers.
4. Confirm expo machines meet minimums (macOS 11+, Windows 10+ with WebView2).
