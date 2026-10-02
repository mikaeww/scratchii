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
| [verification/annotate.md](verification/annotate.md) | Marks: presets, layout on text lines, own marks, deletion with their text |
