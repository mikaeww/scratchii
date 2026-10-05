// The select tool: click to select, shift-click to add, drag to move (also from empty space inside the
// selection box), drag a corner to resize, drag on empty canvas for a marquee. Double-click editing is wired in input.ts.
import { boundsOf } from "../../geometry/bounds.ts";
import { boxFromPoints, contains, overlaps, type Box } from "../../geometry/box.ts";
import { itemAt } from "../../geometry/hit.ts";
import { moveItem, scaleItem } from "../../geometry/transform.ts";
import { attachTarget, detached, movedEnd } from "../../diagram/connect.ts";
import { shapeBox } from "../../geometry/bounds.ts";
import { bendThrough } from "../../geometry/outline.ts";
import { reviseItem, type Item, type LineItem } from "../../model/item.ts";
import type { Editor } from "../editor.ts";
import {
  bendable,
  corner,
  geometryBox,
  handleAt,
  onBendHandle,
  onEndHandle,
  resizeBox,
  selectionBox,
  type Handle,
} from "../selection.ts";
import type { Vec } from "../viewport.ts";
import type { PointerSample, Tool } from "./tool.ts";

const REACH = 6;

type Gesture =
  | { readonly kind: "move"; readonly start: Vec; readonly items: readonly Item[] }
  | { readonly kind: "bend"; readonly line: LineItem }
  | { readonly kind: "end"; readonly line: LineItem; readonly index: 0 | 1 }
  | {
      readonly kind: "resize";
      readonly handle: Handle;
      readonly box: Box;
      readonly start: Vec;
      readonly items: readonly Item[];
    }
  | { readonly kind: "marquee"; readonly start: Vec; readonly base: ReadonlySet<string> };

// A line moved or scaled on its own lets go of the items that stay where they are.
function movable(editor: Editor): Item[] {
  const items = editor.selected();
  const moving = new Set(items.map((item) => item.id));
  return items.map((item) => (item.type === "line" || item.type === "arrow" ? detached(item, moving) : item));
}

// Screen pixels around an item within which a dragged end attaches to it.
const END_REACH = 10;
// Bends beyond this many chord lengths fold the curve over itself.
const MAX_BEND = 1.5;

function begin(editor: Editor, sample: PointerSample): Gesture {
  const selected = movable(editor);
  // Bending keeps the line's attachments; only moving a line on its own lets go of them.
  const line = bendable(editor.selected());
  if (line !== null) {
    const index = onEndHandle(line, editor.view, sample.screen);
    if (index !== null) return { kind: "end", line, index };
    if (onBendHandle(line, editor.view, sample.screen)) return { kind: "bend", line };
  }
  const box = selectionBox(selected);
  // A single line is changed through its end and bend handles; it has no corner handles.
  const handle = box === null || line !== null ? null : handleAt(box, editor.view, sample.screen);
  const geometry = geometryBox(selected);
  if (handle !== null && geometry !== null) {
    return { kind: "resize", handle, box: geometry, start: sample.world, items: selected };
  }
  const hit = itemAt(editor.scene(), sample.world, REACH / editor.view.zoom);
  // Inside the selection box a drag moves the selection, even over empty space in a frame or template.
  if (hit === null && !sample.shift && geometry !== null && contains(geometry, sample.world)) {
    return { kind: "move", start: sample.world, items: selected };
  }
  if (hit === null) {
    if (!sample.shift) editor.setSelection([]);
    return { kind: "marquee", start: sample.world, base: editor.selection };
  }
  if (sample.shift) {
    const next = new Set(editor.selection);
    if (next.has(hit.id)) next.delete(hit.id);
    else next.add(hit.id);
    editor.setSelection(next);
  } else if (!editor.selection.has(hit.id)) {
    editor.setSelection([hit.id]);
  }
  return { kind: "move", start: sample.world, items: movable(editor) };
}

// The dragged end attaches to the item under it, which is highlighted, or is free over empty space.
function dragEnd(editor: Editor, gesture: Extract<Gesture, { kind: "end" }>, sample: PointerSample): void {
  const others = editor.scene().filter((item) => item.id !== gesture.line.id);
  const target = attachTarget(others, sample.world, END_REACH / editor.view.zoom);
  const other = gesture.line.ends[gesture.index === 0 ? 1 : 0];
  const id = target === null || target.id === other ? null : target.id;
  editor.setHint(id === null || target === null ? null : shapeBox(target));
  editor.setDraft([movedEnd(gesture.line, gesture.index, sample.world, id)]);
}

function preview(editor: Editor, gesture: Gesture, sample: PointerSample): void {
  switch (gesture.kind) {
    case "end":
      dragEnd(editor, gesture, sample);
      return;
    case "bend": {
      const { line } = gesture;
      const [a, b] = line.points;
      const local: Vec = [sample.world[0] - line.x, sample.world[1] - line.y];
      const bend = Math.max(-MAX_BEND, Math.min(MAX_BEND, bendThrough(a, b, local)));
      editor.setDraft([{ ...line, bend }]);
      return;
    }
    case "move": {
      const dx = sample.world[0] - gesture.start[0];
      const dy = sample.world[1] - gesture.start[1];
      editor.setDraft(gesture.items.map((item) => moveItem(item, dx, dy)));
      return;
    }
    case "resize": {
      const [cx, cy] = corner(gesture.box, gesture.handle);
      const target: Vec = [cx + sample.world[0] - gesture.start[0], cy + sample.world[1] - gesture.start[1]];
      const to = resizeBox(gesture.box, gesture.handle, target, sample.shift);
      editor.setDraft(gesture.items.map((item) => scaleItem(item, gesture.box, to)));
      return;
    }
    case "marquee": {
      const box = boxFromPoints(gesture.start, sample.world);
      const inside = editor.scene().filter((item) => overlaps(box, boundsOf(item)));
      editor.setMarquee(box);
      editor.setSelection([...gesture.base, ...inside.map((item) => item.id)]);
    }
  }
}

export function createSelect(editor: Editor): Tool {
  let gesture: Gesture | null = null;
  const reset = (): void => {
    gesture = null;
    editor.setDraft([]);
    editor.setMarquee(null);
    editor.setHint(null);
  };
  return {
    cursor: "default",
    down(sample) {
      gesture = begin(editor, sample);
    },
    move(sample) {
      if (gesture !== null) preview(editor, gesture, sample);
    },
    up() {
      const changed = gesture?.kind === "marquee" ? [] : editor.draft.map(reviseItem);
      reset();
      editor.commit(changed);
    },
    cancel: reset,
  };
}
