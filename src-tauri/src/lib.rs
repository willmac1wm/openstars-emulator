mod error;
mod models;
mod stt;
mod tts;

use error::DesktopResult;
use stt::{SttResult, SttStatus};
use tauri::Manager;
use tts::TtsStatus;

#[tauri::command]
fn desktop_info() -> serde_json::Value {
    serde_json::json!({
        "app": "OpenSTARS",
        "publisher": "OpenSTARS",
        "version": env!("CARGO_PKG_VERSION"),
        "desktop": true,
    })
}

#[tauri::command]
fn stt_init(app: tauri::AppHandle) -> DesktopResult<SttStatus> {
    stt::init_stt(&app)
}

#[tauri::command]
fn stt_status(app: tauri::AppHandle) -> SttStatus {
    stt::stt_status(&app)
}

#[tauri::command]
fn stt_transcribe(pcm_b64: String, initial_prompt: String) -> DesktopResult<SttResult> {
    stt::transcribe_pcm_b64(pcm_b64, initial_prompt)
}

#[tauri::command]
fn tts_status() -> TtsStatus {
    tts::tts_status()
}

#[tauri::command]
fn set_kiosk(app: tauri::AppHandle, enabled: bool) -> DesktopResult<()> {
    if let Some(win) = app.get_webview_window("main") {
        win.set_fullscreen(enabled)
            .map_err(|e| error::DesktopError::msg(format!("fullscreen: {e}")))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            desktop_info,
            stt_init,
            stt_status,
            stt_transcribe,
            tts_status,
            set_kiosk,
        ])
        .setup(|app| {
            // Best-effort STT warm-up so the first PTT is fast.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let _ = stt::init_stt(&handle);
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running OpenSTARS desktop");
}
