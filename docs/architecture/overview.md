# Architecture overview

```text
src/main.ts           wiring only
src/model/            Board, Item, validation (trust boundary for every input)
src/editor/           Editor (session state, undo), viewport maths, input, tools/
src/geometry/         item shapes as SVG path data (freehand strokes, clean shape outlines, polygon corners)
src/render/           DrawOp lists per item, canvas drawing, the ink palette read from CSS
src/annotate/          marks: built-in presets, layout on text lines, own marks
src/calc/             maths expressions, answers to a line ending in "=", IPv4 subnets; pure functions
src/recognize/         shape snapping and highlight detection on finished strokes, pure functions
src/sync/             sync client, one sync round (Syncer), the 5 s loop, device sync settings
server/               sync server: node:http + node:sqlite, serves dist/ too
src/storage/          IndexedDB boards and thumbnails, the session (autosave, switching boards), library
                      search, browser file pick and download
src/ui/               DOM chrome: theme/ (tokens, controls), toolbar, style panel, text editor, stage, toasts, text,
                      palette/ (Ctrl+K: the command list and its ranking)
```

## Data flow

1. Pointer events reach `editor/input.ts`, which turns them into samples in world coordinates and hands them to
   the active tool (or the hand while space or the middle button is held).
2. A tool shows work in progress as the editor's `draft` and commits finished items with `editor.commit`.
3. The editor replaces items by id (`putItems`), records the item list in its history and emits a change.
4. `ui/stage.ts` redraws on the next animation frame; `render/ops.ts` caches the path list per item object, so
   only new or changed items are rebuilt.
5. `storage/autosave.ts` writes the board to IndexedDB 400 ms after the last change and when the tab hides.

## Tools and selection

`editor/tools/` holds one tool per file (select, hand, pen, shapes, text and notes, eraser). Tools only build
drafts and commit; keyboard shortcuts and the clipboard live in `editor/shortcuts.ts`, the commands they call
in `editor/commands.ts`. Stacking order is the order of `board.items`: `]` and `[` move the selection to the
top or bottom.

Text widths are measured with the real font when editing ends (`render/measure.ts`) and stored on the item, so
bounds and hit tests stay pure and run in Node.

## Marks

A mark (underline, strike-through, box, highlight) is an item of type `mark` that points at a text item and
carries its strokes in line-local units. `render/marks.ts` measures the text's lines and lays the strokes onto
them, so marks follow every move, resize and edit of their text. The strokes live in the item, never only in a
preset, so a board with own marks looks the same in every browser. Deleting a text deletes its marks in the
same commit (`Editor.commit`). The right-click menu (`ui/menus/context-menu.ts`) applies presets; the pad
(`ui/menus/mark-pad.ts`) records own ones.

## Recognition

The pen starts a 500 ms timer whenever it comes to rest; if it is still resting when the timer fires, the
stroke so far goes to `recognize/shapes.ts` and, if it is a line, arrow, box, ellipse or polygon (triangle,
diamond, star, tilted box, up to six corners; corners found in `recognize/polygons.ts` and straightened in
`recognize/straighten.ts`: right-angled boxes become exact rectangles, level when they lean less than 12°,
nearly level edges become level), the draft becomes that
shape and is committed on lift; moving on turns it back into the freehand stroke. Nearly round ellipses become
circles, nearly square boxes squares, and lines within 5° of a 45° step snap onto it. The marker tool hands its finished stroke and the measured lines of every text
in the scene to `recognize/highlight.ts`; a hit becomes a mark behind the text, otherwise the stroke stays a
translucent marker stroke.

## Files and the library

A `.scratchii` file is `{ format, version, board }` (`model/file.ts`), validated like every other input. An
opened file whose board id already exists becomes a copy with a new id, so nothing stored is overwritten.
Exports draw from the same paint steps as the canvas (`render/order.ts`): PNG from an offscreen canvas at 2×,
PDF as that picture in JPEG inside a one-page PDF (`render/export/pdf.ts`), SVG as paths with the
handwriting font embedded. `storage/session.ts` saves 400 ms after a change and flushes before switching
boards; thumbnails are rendered three seconds after the last save of each board.

## Desktop

`src-tauri/` wraps the built web app (`dist/`) in a Tauri 2 window. It adds only the native save dialog and
the file write behind it (capability `dialog:allow-save`, `fs:allow-write-file`); `storage/disk.ts` uses it
when `__TAURI_INTERNALS__` exists and falls back to a browser download otherwise. Boards stay in IndexedDB,
which WebKitGTK keeps under `~/.local/share/dev.mikaeww.scratchii/` (ADR 0004). File drops are handled by the
page, so the window disables Tauri's own drag and drop. The icon in `src-tauri/icons/` is a placeholder
generated from `assets/icon-placeholder.svg` until the real one exists.

## Sync

`server/` keeps boards in SQLite and numbers every write with a revision. A device runs a round every five
seconds when a server is set (`sync/loop.ts`): it saves pending edits, tells the server about boards deleted
here, pulls boards whose revision grew and merges them (`model/merge.ts`), then pushes boards whose `updated`
grew since the last push. The open board takes remote changes through `Editor.applyRemote`, without an undo
step. Rules and evidence: `docs/verification/sync.md`.

## Handwriting to text

Right-clicking selected pen strokes offers "Convert handwriting to text". `recognize/handwriting.ts` draws the
strokes black on white and hands the picture to Tesseract (tesseract.js, LSTM only, English and German), which
is loaded from `/ocr` on first use; `tools/ocr-assets.ts` copies engine and models there from `node_modules`
before every dev start and build, so nothing is fetched from the net. The reading is shown for correction;
"Replace strokes" runs `strokesToText`, one undo step.

## Versions

Every change makes a new item object with `version + 1` and a fresh `nonce`. Undo and redo do not hand back old
objects: they write the earlier content as newer versions (`editor.ts`, `restore`), so a later sync merge
(phase 7) keeps them.
