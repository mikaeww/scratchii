// Rectangle, ellipse, line and arrow: drag from one corner (or end) to the other. Shift makes squares, circles
// and lines in 45° steps.
import { boxFromPoints } from "../../geometry/box.ts";
import { createItem, type Item, type LineItem, type ShapeItem } from "../../model/item.ts";
import type { Editor } from "../editor.ts";
import type { Vec } from "../viewport.ts";
import type { PointerSample, Tool } from "./tool.ts";

export type ShapeKind = "rect" | "ellipse" | "line" | "arrow";

// Below this drag distance (world units) a press is a click, not a shape.
const MIN_SIZE = 3;

function constrain(start: Vec, end: Vec, kind: ShapeKind): Vec {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (kind === "line" || kind === "arrow") {
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const length = Math.hypot(dx, dy);
    return [start[0] + Math.cos(angle) * length, start[1] + Math.sin(angle) * length];
  }
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  return [start[0] + Math.sign(dx || 1) * side, start[1] + Math.sign(dy || 1) * side];
}

function build(editor: Editor, kind: ShapeKind, start: Vec, end: Vec): Item {
  const { color, size, fill } = editor.style;
  if (kind === "line" || kind === "arrow") {
    return createItem<LineItem>({
      type: kind,
      x: start[0],
      y: start[1],
      color,
      size,
      points: [
        [0, 0],
        [end[0] - start[0], end[1] - start[1]],
      ],
    });
  }
  const box = boxFromPoints(start, end);
  return createItem<ShapeItem>({ type: kind, ...box, color, size, fill });
}

export function createShapeTool(editor: Editor, kind: ShapeKind): Tool {
  let start: Vec | null = null;
  let draft: Item | null = null;
  const update = (sample: PointerSample): void => {
    if (start === null) return;
    const end = sample.shift ? constrain(start, sample.world, kind) : sample.world;
    // Keep id and seed while dragging, so the wobble does not flicker.
    const next = build(editor, kind, start, end);
    draft = draft === null ? next : { ...next, id: draft.id, seed: draft.seed };
    editor.setDraft([draft]);
  };
  return {
    cursor: "crosshair",
    down(sample) {
      start = sample.world;
      draft = null;
    },
    move: update,
    up(sample) {
      update(sample);
      const finished = draft;
      const origin = start;
      start = null;
      draft = null;
      editor.setDraft([]);
      if (finished === null || origin === null) return;
      if (Math.hypot(sample.world[0] - origin[0], sample.world[1] - origin[1]) < MIN_SIZE) return;
      editor.commit([finished]);
    },
    cancel() {
      start = null;
      draft = null;
      editor.setDraft([]);
    },
  };
}
