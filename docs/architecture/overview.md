# Architecture overview

```text
src/main.ts           wiring only
src/model/            Board, Item, validation (trust boundary for every input)
src/editor/           Editor (session state, undo), viewport maths, input, tools/
src/geometry/         item shapes as SVG path data (freehand outline, later rough shapes)
src/render/           DrawOp lists per item, canvas drawing, the ink palette read from CSS
src/storage/          IndexedDB boards, autosave and the last open board
src/ui/               DOM chrome: tokens (theme.css), controls, toolbar, stage, toasts, text
```

## Data flow

1. Pointer events reach `editor/input.ts`, which turns them into samples in world coordinates and hands them to
   the active tool (or the hand while space or the middle button is held).
2. A tool shows work in progress as the editor's `draft` and commits finished items with `editor.commit`.
3. The editor replaces items by id (`putItems`), records the item list in its history and emits a change.
4. `ui/stage.ts` redraws on the next animation frame; `render/ops.ts` caches the path list per item object, so
   only new or changed items are rebuilt.
5. `storage/autosave.ts` writes the board to IndexedDB 400 ms after the last change and when the tab hides.

## Versions

Every change makes a new item object with `version + 1` and a fresh `nonce`. Undo and redo do not hand back old
objects: they write the earlier content as newer versions (`editor.ts`, `restore`), so a later sync merge
(phase 7) keeps them.
