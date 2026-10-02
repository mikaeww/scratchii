# Roadmap

Phases come from the [build plan](plans/2026-10-02-buildplan.md). A phase is done when `npm run check` passes,
the real check is noted in its commit, and its claims in `verification/` have measured results.

All nine phases are done as of 2026-10-02. Open: a real-stroke corpus for shape snapping and handwriting, the
real app icon, publishing.

| Phase | Content | State |
|---|---|---|
| 0 | Skeleton, docs, check tooling, private repo | done |
| 1 | Canvas core: model, viewport, pen, history, autosave | done |
| 2 | Shapes, text, notes, selection, style panel | done |
| 3 | Annotations and underline presets, own presets | done |
| 4 | Shape snapping and text highlighter | done |
| 5 | `.scratchii` files, PNG/SVG/PDF export, library | done |
| 6 | Desktop app with Tauri, install script, packages | done |
| 7 | Self-hosted sync server and client | done |
| 8 | Handwriting to text (experimental) | done |
| 9 | Settings, German, accessibility pass, screenshots | done |
