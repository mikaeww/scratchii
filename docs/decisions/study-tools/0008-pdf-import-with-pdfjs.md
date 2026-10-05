# 0008: PDF import with pdf.js

**Status:** accepted
**Date:** 2026-10-05

## Context
Students write on lecture slides, administrative staff on forms and regulations; both arrive as PDF
(docs/plans/2026-10-05-study-tools.md, step 8). Scratchii has pictures as items but cannot read PDF. ADR 0003
asks for an ADR for every large dependency. Number 0006 is taken by the Fold board link plan.

## Options
- pdf.js (`pdfjs-dist`, Apache-2.0, Mozilla): renders pages to a canvas in the browser and in WebKitGTK; about
  1.5 MB of script and worker in the build.
- A PDF parser of our own: text and vector PDFs with fonts are far beyond what this app should carry.
- Tauri side with a native library (poppler, pdfium): only the desktop app would get it, the web build not, and
  a native dependency makes the build and the Windows path harder.

## Decision
pdf.js, pinned (`pdfjs-dist` 6.4.299), loaded with a dynamic import only when a PDF arrives, its worker served
as an asset. Each page becomes a picture item (JPEG, longest side 1600 px, 800 world units wide), pages stacked
from the middle of the view downwards. At most 60 pages per import; more are reported, not silently dropped.

## Consequences
- Start-up does not load pdf.js; the first PDF import loads it once.
- `pdfjs-dist` lists `@napi-rs/canvas` as an optional dependency for rendering in Node; npm installs it for the
  dev machine, the app never loads it and the build does not contain it.
- Pages are pictures: text in them cannot be searched or selected, which the library search reports as no hit.
- A board with many pages grows by about 0.2 to 0.4 MB per page; the sync server accepts up to 64 MB per board.
