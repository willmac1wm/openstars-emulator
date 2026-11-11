//! Resolve bundled model paths under the installer resources directory.

use crate::error::{DesktopError, DesktopResult};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub fn resource_root(app: &AppHandle) -> DesktopResult<PathBuf> {
    app.path()
        .resource_dir()
        .map_err(|e| DesktopError::msg(format!("resource_dir: {e}")))
}

pub fn models_dir(app: &AppHandle) -> DesktopResult<PathBuf> {
    Ok(resource_root(app)?.join("models"))
}

pub fn whisper_model_candidates(app: &AppHandle) -> DesktopResult<Vec<(String, PathBuf)>> {
    let base = models_dir(app)?.join("whisper");
    // Prefer accuracy, then fall back for weak CPUs (selected by startup benchmark).
    Ok(vec![
        (
            "large-v3-turbo-q5_0".into(),
            base.join("ggml-large-v3-turbo-q5_0.bin"),
        ),
        (
            "large-v3-turbo-q8_0".into(),
            base.join("ggml-large-v3-turbo-q8_0.bin"),
        ),
        ("small.en-q5_1".into(), base.join("ggml-small.en-q5_1.bin")),
        ("base.en-q5_1".into(), base.join("ggml-base.en-q5_1.bin")),
        ("base.en".into(), base.join("ggml-base.en.bin")),
    ])
}

pub fn first_existing_whisper(app: &AppHandle) -> DesktopResult<(String, PathBuf)> {
    for (name, path) in whisper_model_candidates(app)? {
        if path.is_file() {
            return Ok((name, path));
        }
    }
    Err(DesktopError::msg(
        "No Whisper model found under resources/models/whisper. Run scripts/fetch-desktop-models.mjs",
    ))
}

pub fn path_exists(p: &Path) -> bool {
    p.is_file()
}
