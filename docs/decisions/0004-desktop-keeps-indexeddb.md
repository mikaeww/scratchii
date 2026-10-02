# 0004: The desktop app keeps boards in IndexedDB

**Status:** accepted
**Date:** 2026-10-02

## Context
The build plan (phase 6) said boards on the desktop live as files under `~/.local/share/scratchii`. The web app
already stores boards, thumbnails and own marks in IndexedDB, and Tauri's WebKitGTK webview persists IndexedDB
on disk under `~/.local/share/dev.mikaeww.scratchii/`.

## Options
- A second storage backend writing one `.scratchii` file per board, behind a storage interface, with its own
  listing, thumbnails and tests.
- IndexedDB everywhere; the desktop adds native dialogs for saving and exporting files wherever the user wants.

## Decision
IndexedDB everywhere. The desktop shell only adds the native save dialog and the file write
(`tauri-plugin-dialog`, `tauri-plugin-fs`, capability limited to `dialog:allow-save` and `fs:allow-write-file`).
Opening files uses the regular file picker, which WebKitGTK shows as the GTK dialog.

## Consequences
- One storage path to test; browser and desktop behave the same.
- Boards are not loose files on disk. Backups go through "Save as file" or, from phase 7, the sync server.
- If boards as plain files become a real need, a new ADR adds a file backend behind `storage/local.ts`.
