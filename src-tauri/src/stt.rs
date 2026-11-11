//! Native Whisper STT (whisper.cpp via whisper-rs).
//! Models are bundled under resources/models/whisper/.

use crate::error::{DesktopError, DesktopResult};
use crate::models::{first_existing_whisper, whisper_model_candidates};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use serde::Serialize;
use std::path::PathBuf;
use std::time::Instant;
use tauri::AppHandle;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

static ENGINE: OnceCell<Mutex<SttEngine>> = OnceCell::new();

pub struct SttEngine {
    pub model_id: String,
    pub model_path: PathBuf,
    pub backend: String,
    ctx: WhisperContext,
    pub last_benchmark_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SttStatus {
    pub ready: bool,
    pub model_id: String,
    pub backend: String,
    pub last_benchmark_ms: u64,
    pub available_models: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SttResult {
    pub text: String,
    pub alternatives: Vec<String>,
    pub latency_ms: u64,
    pub model_id: String,
}

fn detect_backend() -> String {
    #[cfg(target_os = "macos")]
    {
        // whisper-rs with metal feature reports via compile; label for UI.
        return "cpu+metal".into();
    }
    #[cfg(all(not(target_os = "macos"), target_os = "windows"))]
    {
        return "cpu+vulkan".into();
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        "cpu".into()
    }
}

fn load_context(path: &PathBuf) -> DesktopResult<WhisperContext> {
    WhisperContext::new_with_params(
        path.to_str().ok_or_else(|| DesktopError::msg("invalid model path"))?,
        WhisperContextParameters::default(),
    )
    .map_err(|e| DesktopError::msg(format!("whisper load: {e}")))
}

/// Tiny synthetic 1s 16 kHz sine for startup benchmark (no audio capture needed).
fn bench_pcm() -> Vec<f32> {
    let sr = 16_000usize;
    let mut samples = vec![0f32; sr];
    for (i, s) in samples.iter_mut().enumerate() {
        let t = i as f32 / sr as f32;
        *s = (2.0 * std::f32::consts::PI * 440.0 * t).sin() * 0.1;
    }
    samples
}

fn transcribe_inner(
    engine: &SttEngine,
    pcm16k: &[f32],
    initial_prompt: &str,
) -> DesktopResult<(String, u64)> {
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_n_threads(num_threads());
    params.set_language(Some("en"));
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_single_segment(true);
    if !initial_prompt.is_empty() {
        params.set_initial_prompt(initial_prompt);
    }

    let mut state = engine
        .ctx
        .create_state()
        .map_err(|e| DesktopError::msg(format!("whisper state: {e}")))?;

    let t0 = Instant::now();
    state
        .full(params, pcm16k)
        .map_err(|e| DesktopError::msg(format!("whisper full: {e}")))?;
    let latency_ms = t0.elapsed().as_millis() as u64;

    let mut text = String::new();
    let n = state
        .full_n_segments()
        .map_err(|e| DesktopError::msg(format!("whisper n_segments: {e}")))?;
    for i in 0..n {
        if let Ok(seg) = state.full_get_segment_text_lossy(i) {
            text.push_str(&seg);
        }
    }
    Ok((text.trim().to_string(), latency_ms))
}

fn num_threads() -> std::ffi::c_int {
    let n = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    std::cmp::min(n, 8) as std::ffi::c_int
}

/// Pick the best model that still feels instant after a quick bench.
pub fn init_stt(app: &AppHandle) -> DesktopResult<SttStatus> {
    let candidates = whisper_model_candidates(app)?;
    let existing: Vec<_> = candidates
        .into_iter()
        .filter(|(_, p)| p.is_file())
        .collect();
    if existing.is_empty() {
        return Err(DesktopError::msg(
            "No Whisper models bundled. CI should run scripts/fetch-desktop-models.mjs",
        ));
    }

    let backend = detect_backend();
    let pcm = bench_pcm();
    // Prefer largest; if bench > 700ms wall on CPU sine (proxy), step down.
    let mut chosen: Option<(String, PathBuf, WhisperContext, u64)> = None;
    for (id, path) in &existing {
        match load_context(path) {
            Ok(ctx) => {
                let engine = SttEngine {
                    model_id: id.clone(),
                    model_path: path.clone(),
                    backend: backend.clone(),
                    ctx,
                    last_benchmark_ms: 0,
                };
                match transcribe_inner(&engine, &pcm, "United one two three") {
                    Ok((_, ms)) => {
                        let weak = ms > 700 && (id.contains("large") || id.contains("turbo"));
                        if weak {
                            continue;
                        }
                        chosen = Some((id.clone(), path.clone(), engine.ctx, ms));
                        break;
                    }
                    Err(_) => continue,
                }
            }
            Err(_) => continue,
        }
    }

    let (model_id, model_path, ctx, bench_ms) = match chosen {
        Some(c) => c,
        None => {
            let (id, path) = first_existing_whisper(app)?;
            let ctx = load_context(&path)?;
            (id, path, ctx, 0)
        }
    };

    let engine = SttEngine {
        model_id: model_id.clone(),
        model_path,
        backend: backend.clone(),
        ctx,
        last_benchmark_ms: bench_ms,
    };
    let _ = ENGINE.set(Mutex::new(engine));

    Ok(SttStatus {
        ready: true,
        model_id,
        backend,
        last_benchmark_ms: bench_ms,
        available_models: existing.into_iter().map(|(id, _)| id).collect(),
    })
}

pub fn stt_status(app: &AppHandle) -> SttStatus {
    if let Some(lock) = ENGINE.get() {
        let e = lock.lock();
        return SttStatus {
            ready: true,
            model_id: e.model_id.clone(),
            backend: e.backend.clone(),
            last_benchmark_ms: e.last_benchmark_ms,
            available_models: whisper_model_candidates(app)
                .unwrap_or_default()
                .into_iter()
                .filter(|(_, p)| p.is_file())
                .map(|(id, _)| id)
                .collect(),
        };
    }
    SttStatus {
        ready: false,
        model_id: String::new(),
        backend: detect_backend(),
        last_benchmark_ms: 0,
        available_models: whisper_model_candidates(app)
            .unwrap_or_default()
            .into_iter()
            .filter(|(_, p)| p.is_file())
            .map(|(id, _)| id)
            .collect(),
    }
}

/// Decode base64 PCM f32 LE mono 16 kHz and transcribe with ATC initial_prompt.
pub fn transcribe_pcm_b64(
    pcm_b64: String,
    initial_prompt: String,
) -> DesktopResult<SttResult> {
    let engine_cell = ENGINE
        .get()
        .ok_or_else(|| DesktopError::msg("STT not initialized"))?;
    let engine = engine_cell.lock();

    let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, pcm_b64)
        .map_err(|e| DesktopError::msg(format!("base64: {e}")))?;
    if bytes.len() % 4 != 0 {
        return Err(DesktopError::msg("PCM byte length not multiple of 4"));
    }
    let mut pcm = Vec::with_capacity(bytes.len() / 4);
    for chunk in bytes.chunks_exact(4) {
        pcm.push(f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]));
    }
    if pcm.is_empty() {
        return Err(DesktopError::msg("empty audio"));
    }

    let (text, latency_ms) = transcribe_inner(&engine, &pcm, &initial_prompt)?;
    Ok(SttResult {
        text: text.clone(),
        alternatives: if text.is_empty() {
            vec![]
        } else {
            vec![text]
        },
        latency_ms,
        model_id: engine.model_id.clone(),
    })
}
