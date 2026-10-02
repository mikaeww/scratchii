//! Desktop shell for Scratchii: one window around the web app plus native file dialogs and file writes.
//! All app logic lives in the TypeScript frontend (ADR 0001); nothing here knows about boards.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!());
    if let Err(error) = result {
        eprintln!("scratchii: {error}");
        std::process::exit(1);
    }
}
