# Build plan

**Date:** 2026-10-02 · **Status:** done 2026-10-02; deviations are noted in the phases and in ADR 0004

## Outcome

Scratchii is a whiteboard for notes and sketches on a clean white surface. Everything on it looks drawn by a
person and styled in Neo Brutalism: thick black outlines, flat bright fills, hard offset shadows, handwritten
text. It runs in the browser and as a desktop program on Linux (Tauri). Boards live in a local library, can be
saved as `.scratchii` files, exported as PNG, SVG or PDF, and synced through a small self-hosted server.

When the plan is done, a user can:

1. Draw with a pen that feels like a felt marker, and place boxes, ellipses, lines, arrows, text and sticky notes.
2. Hold the pen still at the end of a scribbled shape and get a clean, still hand-drawn rectangle, ellipse,
   line or arrow.
3. Drag the marker over text and get a highlight that sticks to that text line.
4. Right-click a text, pick one of eight hand-drawn underline presets, or draw an own one and reuse it.
5. Turn handwriting into typed text (experimental, offline).
6. Find every board in a library with search, tags and thumbnails; open and save `.scratchii` files.
7. Sync boards between the desktop app and a browser through an own server, without losing edits.

## Decisions taken with the owner (2026-10-02)

| Topic | Decision |
|---|---|
| Stack | TypeScript web app (Vite, Canvas 2D) plus a thin Tauri 2 shell for the desktop, ADR 0001 |
| Design | Neo Brutalism, light only, overrides the grey clean-project language, ADR 0002 |
| Fonts | Shantell Sans on the canvas, Space Grotesk in the interface, both OFL and bundled |
| Backend in v1 | Local files and export, board library, self-hosted sync server |
| Recognition | Shape snapping, text highlighter, handwriting to text |
| Underlines | Eight built-in hand-drawn presets plus own presets drawn by the user |
| Git | Private repo `mikaeww/scratchii`, one commit per checked step, no AI attribution |

## Architecture in one picture

```text
 src/ui  ──────►  src/editor  ──────►  src/model  ◄──────  server/   (node:http + node:sqlite)
  DOM chrome       tools, history,      board, elements,      sync API, stores boards,
  (toolbar,        selection,           validation, merge     serves the built web app
  menus,           viewport                 ▲
  library)             │                    │
                       ▼                    │
                  src/geometry  ───►  src/render  (Canvas + SVG + PNG + PDF from one path list)
                  wobble, freehand,
                  shapes, hit tests      src/recognize  (shapes, highlighter, handwriting)
                                         src/annotate   (underline presets, custom presets)
                  src/storage  (IndexedDB in the browser, files via Tauri on the desktop)
                  src/sync     (client for server/)
```

Every element turns into a list of path operations (`d` string, fill, stroke, shadow). The canvas draws them
through `Path2D`, the SVG export writes them as `<path>`. One geometry source, two thin output backends.

## Dependencies

Runtime: `perfect-freehand` (pressure strokes), `roughjs` (hand-drawn shape outlines), `tesseract.js`
(phase 8, loaded lazily), `@tauri-apps/api` and the dialog and fs plugins (desktop only). Development: `vite`,
`typescript` 6.0 (typescript-eslint does not support 7 yet), `eslint` with `typescript-eslint`, `prettier`.
Tests use `node --test`; the sync server uses only the Node standard library (`node:http`, `node:sqlite`).
Versions are pinned exactly in `package.json`.

## Phases

Each phase ends with `npm run check` green, a real check in the running app, a commit and a push.

### Phase 0 — skeleton

README, AGENTS/CLAUDE, `docs/` (index, conventions, vision, roadmap, verification, ADR template, ADRs 0001
to 0003), check tooling: `tools/check.ts` (prettier, eslint, tsc, structure, tests, cargo fmt and clippy once
`src-tauri/` exists) and `tools/structure.ts` with its own tests. Private GitHub repo, first commit.

### Phase 1 — canvas core

- Model: `Board`, `Element` (id, type, position, size, style, seed, version, nonce, deleted).
- Viewport: infinite canvas, pan with space or middle mouse, zoom on wheel and pinch, device pixel ratio.
- Pen tool with `perfect-freehand`, pressure from pointer events, simulated for mice.
- Renderer: dirty flag plus `requestAnimationFrame`, only on change.
- History: undo and redo as snapshots of the immutable element list.
- Autosave of the current board to IndexedDB.
- Neo Brutalism tokens in `src/ui/theme/tokens.css`, toolbar with the tools of this phase.

### Phase 2 — shapes, text, notes, selection

- Rectangle, ellipse, line, arrow via `roughjs` with low roughness, thick black stroke, flat fill and a hard
  offset shadow; seeds keep the wobble stable between frames.
- Text in Shantell Sans, edited in place with a textarea overlay; sticky notes as coloured cards with
  handwritten text.
- Select, marquee, move, resize, delete, duplicate, copy and paste, z-order, eraser.
- Style panel: palette from the reference image, three stroke widths, fill on or off.

### Phase 3 — annotations and underlines

- Annotations are elements bound to a text element and a line range; they move and stretch with it.
- Right-click on text opens a context menu with previews of eight presets: line, double, wave, zigzag, marker
  bar, scribble, box, strike-through.
- "Draw your own" opens a small pad; the stroke is normalised to the unit width and saved as a preset.

### Phase 4 — recognition

- Shape snapping: hold the pen still for 500 ms at the end of a stroke; the stroke is classified as line,
  arrow, rectangle, ellipse or none, and replaced by the matching shape element.
- Highlighter: marker strokes that cover a text line become a highlight annotation on that line.
- Verification plan `docs/verification/recognize.md` before the code (claims, synthetic and recorded corpus,
  thresholds).

### Phase 5 — files, export, library

- `.scratchii` files (JSON, versioned, validated on load with the location of every error).
- Export PNG (canvas), SVG (same path list), PDF (one page, a JPEG embedded as is, written by an own small
  PDF writer; changed from a deflated PNG during phase 5 because PDF takes JPEG without any encoding step).
- Paste images and drop files onto the canvas.
- Library view: grid of boards with thumbnails, search over title and text, tags, rename, delete with undo.

### Phase 6 — desktop

- `src-tauri/`: window, native open and save dialogs, boards as files under `~/.local/share/scratchii`.
- `.desktop` entry, `install.sh` for Arch, AppImage and `.deb` from `tauri build`.

### Phase 7 — sync server

- `server/`: `node:http` + `node:sqlite`, bearer token compared in constant time, body size limit, input
  validated with the same model code as the app, serves the built web app so a browser can use it directly.
- Merge per element: higher version wins, equal versions are decided by the lower nonce, deletions are
  tombstones. Verification plan `docs/verification/merge.md`: commutative, associative and idempotent, checked
  exhaustively on small version sets.
- Client: syncs changed boards every few seconds when a server is set; status in the toolbar.

### Phase 8 — handwriting to text

- Select strokes, "Convert to text" in the context menu, `tesseract.js` with bundled English and German
  data, loaded only on first use. Marked experimental: Tesseract is trained on print, so handwriting accuracy
  will be low; the result is shown for confirmation before anything is replaced.

### Phase 9 — settings, language, polish

- Settings dialog: grid, sync server URL and token, language. Changed during phase 9: no autosave switch
  (switching it off could only lose work) and no default-stroke setting (the style panel's last choice is
  remembered instead).
- English interface by default, German selectable.
- Accessibility pass: keyboard reachable chrome, visible focus, reduced motion.
- `tools/render.ts` for README screenshots through headless Chromium (no window), README update.

## Risks

- Handwriting recognition quality (see phase 8). If it is unusable, it stays behind an experimental switch.
- `tauri build` AppImage packaging depends on host tools; the `.deb` and the plain binary are the fallback.
- Neo Brutalism wobble on every shape costs CPU on big boards; render paths are cached per element version.
