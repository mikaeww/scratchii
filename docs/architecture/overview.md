# Architecture overview

```text
src/main.ts           wiring only
src/model/            Board, Item, validation (trust boundary for every input)
src/editor/           Editor (session state, undo), viewport maths, input, tools/
src/geometry/         item shapes as SVG path data (freehand outline, later rough shapes)
src/render/           DrawOp lists per item, canvas drawing, the ink palette read from CSS
src/annotate/          marks: built-in presets, layout on text lines, own marks
src/storage/          IndexedDB boards, autosave and the last open board
src/ui/               DOM chrome: theme/ (tokens, controls), toolbar, style panel, text editor, stage, toasts, text
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

## Versions

Every change makes a new item object with `version + 1` and a fresh `nonce`. Undo and redo do not hand back old
objects: they write the earlier content as newer versions (`editor.ts`, `restore`), so a later sync merge
(phase 7) keeps them.
