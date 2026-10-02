# 0001: Web app with a thin Tauri shell

**Status:** accepted
**Date:** 2026-10-02

## Context
Scratchii has to run in a browser and as an installed program on Linux. Drawing needs a fast 2D surface,
pointer pressure and good text rendering. The owner already ships Rust (Rewa) and Python/Qt (Filyy, Calendary).

## Options
- **Web app plus Tauri 2:** one TypeScript frontend on Canvas 2D; Tauri wraps it in the system WebKitGTK for the
  desktop and adds native dialogs and file access. Small binary, no bundled browser.
- **Web app as PWA only:** least code, but Firefox and Zen cannot install PWAs and file access is limited to
  browser dialogs.
- **Web app plus Electron:** widest compatibility, but around 150 MB and a full Chromium per window.
- **Native Qt/QML app plus a separate web version:** two frontends to keep in step.

## Decision
TypeScript with Vite and Canvas 2D, no UI framework; the interface chrome is plain DOM. Tauri 2 is the desktop
shell with the dialog and fs plugins. Rust code stays a thin layer; all logic is in TypeScript so the browser
and the desktop behave the same.

## Consequences
- Storage needs two backends (IndexedDB in the browser, files on the desktop) behind one small interface.
- WebKitGTK and Chromium differ in pointer pressure and font rendering; both are checked.
- Tests run on `node --test` against the pure modules (model, geometry, recognition, merge); the DOM layer is
  checked through headless screenshots.
