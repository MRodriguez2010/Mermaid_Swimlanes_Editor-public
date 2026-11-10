mod ai;
mod commands;

use commands::ai::{
    cancel_ai_request, delete_ai_api_key, get_ai_api_key, list_ai_history, list_ollama_models,
    run_ai_request, save_ai_api_key, save_ai_history, AiRuntimeState,
};
use commands::files::{read_text_file, write_text_file};
use commands::snapshots::{
    get_latest_document, get_snapshot_content, list_snapshots, prune_snapshots, restore_snapshot,
    save_snapshot,
};
use commands::system::open_external_url;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AiRuntimeState::default())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            save_snapshot,
            list_snapshots,
            get_snapshot_content,
            restore_snapshot,
            get_latest_document,
            prune_snapshots,
            run_ai_request,
            cancel_ai_request,
            save_ai_api_key,
            get_ai_api_key,
            delete_ai_api_key,
            save_ai_history,
            list_ai_history,
            list_ollama_models,
            open_external_url
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Mermaid Local");
}
