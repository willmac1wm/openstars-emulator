//! Resolve Whisper model paths.
//!
//! Large ggml weights are intentionally **not** sealed inside the macOS `.app`
//! (deep codesign of ~900MB resources hung aarch64 CI for hours). Prefer:
//! 1. Writable app-data dir (downloaded on first launch)
//! 2. Bundled `resources/models` (local/dev when `npm run fetch-desktop-models` was used)

use crate::error::{DesktopError, DesktopResult};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const WHISPER_HF_BASE: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

/// Files fetched on first launch when nothing is present locally.
/// Order: smaller base first so STT can warm quickly, then accuracy upgrades.
const WHISPER_DOWNLOADS: &[(&str, &str)] = &[
    (
        "ggml-base.en-q5_1.bin",
        "ggml-base.en-q5_1.bin",
    ),
    (
        "ggml-small.en-q5_1.bin",
        "ggml-small.en-q5_1.bin",
    ),
    (
        "ggml-large-v3-turbo-q5_0.bin",
        "ggml-large-v3-turbo-q5_0.bin",
    ),
];

pub fn resource_root(app: &AppHandle) -> DesktopResult<PathBuf> {
    app.path()
        .resource_dir()
        .map_err(|e| DesktopError::msg(format!("resource_dir: {e}")))
}

pub fn app_models_dir(app: &AppHandle) -> DesktopResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| DesktopError::msg(format!("app_data_dir: {e}")))?
        .join("models");
    Ok(dir)
}

pub fn models_dir(app: &AppHandle) -> DesktopResult<PathBuf> {
    let data = app_models_dir(app)?;
    if data.join("whisper").is_dir() {
        return Ok(data);
    }
    Ok(resource_root(app)?.join("models"))
}

fn whisper_roots(app: &AppHandle) -> DesktopResult<Vec<PathBuf>> {
    let mut roots = Vec::with_capacity(2);
    let data = app_models_dir(app)?.join("whisper");
    roots.push(data);
    roots.push(resource_root(app)?.join("models").join("whisper"));
    Ok(roots)
}

pub fn whisper_model_candidates(app: &AppHandle) -> DesktopResult<Vec<(String, PathBuf)>> {
    // Prefer accuracy, then fall back for weak CPUs (selected by startup benchmark).
    // Search app-data first so a first-run download wins over an empty sealed bundle.
    let names = [
        ("large-v3-turbo-q5_0", "ggml-large-v3-turbo-q5_0.bin"),
        ("large-v3-turbo-q8_0", "ggml-large-v3-turbo-q8_0.bin"),
        ("small.en-q5_1", "ggml-small.en-q5_1.bin"),
        ("base.en-q5_1", "ggml-base.en-q5_1.bin"),
        ("base.en", "ggml-base.en.bin"),
    ];
    let roots = whisper_roots(app)?;
    let mut out = Vec::with_capacity(names.len());
    for (id, file) in names {
        let mut path = roots[0].join(file);
        for root in &roots {
            let candidate = root.join(file);
            if candidate.is_file() {
                path = candidate;
                break;
            }
        }
        out.push((id.to_string(), path));
    }
    Ok(out)
}

pub fn first_existing_whisper(app: &AppHandle) -> DesktopResult<(String, PathBuf)> {
    for (name, path) in whisper_model_candidates(app)? {
        if path.is_file() {
            return Ok((name, path));
        }
    }
    Err(DesktopError::msg(
        "No Whisper model found. First launch downloads weights into app data, or run npm run fetch-desktop-models for a local bundle.",
    ))
}

pub fn path_exists(p: &Path) -> bool {
    p.is_file()
}

fn any_whisper_present(app: &AppHandle) -> bool {
    whisper_model_candidates(app)
        .ok()
        .map(|c| c.iter().any(|(_, p)| p.is_file()))
        .unwrap_or(false)
}

fn download_file(url: &str, dest: &Path) -> DesktopResult<()> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }
    let partial = dest.with_extension("partial");
    let mut resp = ureq::get(url)
        .set("User-Agent", "OpenSTARS-desktop/0.1")
        .call()
        .map_err(|e| DesktopError::msg(format!("download {url}: {e}")))?;
    if !(200..300).contains(&resp.status()) {
        return Err(DesktopError::msg(format!(
            "download {url}: HTTP {}",
            resp.status()
        )));
    }
    let mut file = File::create(&partial)?;
    let mut reader = resp.into_reader();
    let mut buf = [0u8; 1024 * 256];
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n])?;
    }
    file.flush()?;
    drop(file);
    fs::rename(&partial, dest)?;
    Ok(())
}

/// Ensure at least one Whisper ggml file exists under app data (or resources).
/// Downloads from Hugging Face into the writable app-data dir when missing.
/// Safe to call from a background thread at startup.
pub fn ensure_whisper_models(app: &AppHandle) -> DesktopResult<()> {
    if any_whisper_present(app) {
        return Ok(());
    }
    let dest_root = app_models_dir(app)?.join("whisper");
    fs::create_dir_all(&dest_root)?;
    let mut last_err: Option<DesktopError> = None;
    for (file, _) in WHISPER_DOWNLOADS {
        let dest = dest_root.join(file);
        if dest.is_file() && dest.metadata().map(|m| m.len() > 1_000).unwrap_or(false) {
            continue;
        }
        let url = format!("{WHISPER_HF_BASE}/{file}");
        eprintln!("[openstars] downloading Whisper model {file} → {}", dest.display());
        match download_file(&url, &dest) {
            Ok(()) => {
                eprintln!(
                    "[openstars] wrote {} ({} bytes)",
                    dest.display(),
                    dest.metadata().map(|m| m.len()).unwrap_or(0)
                );
                // One model is enough to start STT; keep fetching the rest.
            }
            Err(e) => {
                eprintln!("[openstars] model download failed for {file}: {e}");
                last_err = Some(e);
            }
        }
        if any_whisper_present(app) && file.starts_with("ggml-base") {
            // Continue downloading larger models in the same pass when possible.
            continue;
        }
    }
    if any_whisper_present(app) {
        return Ok(());
    }
    Err(last_err.unwrap_or_else(|| {
        DesktopError::msg("Failed to download Whisper models (network required on first launch)")
    }))
}
