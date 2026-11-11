//! Desktop TTS status.
//!
//! Synthesis runs in the webview with bundled Kokoro-82M ONNX (Apache-2.0) and
//! OpenSTARS ATC G2P lexicon (Apache-2.0) — **no eSpeak NG / GPL phonemizer**
//! is shipped in the desktop installer. Native ORT acceleration can wrap the
//! same weights later; the UI reports the active path.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsStatus {
    pub engine: String,
    pub model_id: String,
    pub phonemizer: String,
    pub license_note: String,
    pub ready: bool,
}

pub fn tts_status() -> TtsStatus {
    TtsStatus {
        engine: "kokoro-webview-onnx".into(),
        model_id: "onnx-community/Kokoro-82M-v1.0-ONNX (q8)".into(),
        phonemizer: "OpenSTARS ATC G2P lexicon (no eSpeak NG)".into(),
        license_note: "Kokoro weights Apache-2.0; ATC G2P Apache-2.0; eSpeak NG GPL-3.0 intentionally not bundled in desktop".into(),
        ready: true,
    }
}
