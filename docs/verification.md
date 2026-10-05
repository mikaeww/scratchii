# Verification

## Policy

- Every component with non-trivial logic has a plan in `verification/` before its code: claims, oracle, method,
  corpus, thresholds, known gaps.
- A check that did not run is not passed. Results go into the plan with the date they were measured.
- Headless screenshots (`tools/render.ts`) are evidence for layout only, not for pen feel or real input devices.
- Nothing in the tests talks to a real sync server or the user's boards.

## Plans

| Plan | Component |
|---|---|
| [verification/model.md](verification/model.md) | Board and item model, validation, undo history, viewport |
| [verification/geometry.md](verification/geometry.md) | Item bounds, hit tests, moving and scaling |
| [verification/recognize.md](verification/recognize.md) | Shape snapping and text highlighter |
| [verification/files.md](verification/files.md) | `.scratchii` files, SVG/PNG/PDF export, library search |
| [verification/sync.md](verification/sync.md) | Sync merge, server, client |
| [verification/handwriting.md](verification/handwriting.md) | Handwriting to text (experimental) |
| [verification/annotate.md](verification/annotate.md) | Marks: presets, layout on text lines, own marks, deletion with their text |
| [verification/study-tools/calc.md](verification/study-tools/calc.md) | Calculation: expressions, `=` answers, base conversion, subnets |
| [verification/study-tools/palette.md](verification/study-tools/palette.md) | Command palette: ranking, arguments |
| [verification/study-tools/graphs.md](verification/study-tools/graphs.md) | Function graphs and charts: ticks, sampling, edit text |
| [verification/study-tools/tables.md](verification/study-tools/tables.md) | Tables: cell grid, rows and columns, fitting text, pasted cells |
| [verification/study-tools/connectors.md](verification/study-tools/connectors.md) | Labels and lines attached to items |
| [verification/study-tools/diagrams.md](verification/study-tools/diagrams.md) | Flowcharts from text: reading, layout, building |

## Accessibility check

2026-10-02, headless Chrome on the running app: every visible button, input, select and canvas has an
accessible name (two misses found and fixed: the own-mark drawing area, and decorative preview canvases now
hidden from assistive tech); Tab reaches 32 controls of the chrome and each shows a focus outline (the board
title had suppressed it, fixed). Dialogs are native `<dialog>` elements, menus move with arrow keys and close
with Escape, and reduced motion sets all transition durations to 0. Not checked: a real screen reader.
