// The pen: one pointer stroke becomes one stroke item. Holding the pen still at the end of a stroke turns a
// recognised scribble into a clean shape (src/recognize/shapes.ts), committed when the pen lifts; moving on
// keeps drawing freehand.
import { createItem, type Item, type StrokeItem, type StrokePoint } from "../../model/item.ts";
import { recogniseShape } from "../../recognize/shapes.ts";
import type { Editor } from "../editor.ts";
import type { Vec } from "../viewport.ts";
import { polygonItem, shapeItem } from "./shape.ts";
import type { PointerSample, Tool } from "./tool.ts";

// How long the pen must rest, and how far (screen pixels) it may tremble while resting.
const HOLD_MS = 500;
const HOLD_SLACK = 4;
// Samples closer than this (screen pixels) to the last kept one add nothing but blots where the pen slows down.
const MIN_GAP = 1;

function relative(draft: StrokeItem, sample: PointerSample): StrokePoint {
  return [sample.world[0] - draft.x, sample.world[1] - draft.y, sample.hasPressure ? sample.pressure : 0.5];
}

function snap(editor: Editor, stroke: StrokeItem): Item | null {
  const shape = recogniseShape(stroke.points.map(([x, y]) => [stroke.x + x, stroke.y + y] as const));
  if (shape === null) return null;
  const style = { ...editor.style, color: stroke.color, size: stroke.size };
  if ("box" in shape) {
    const { x, y, width, height } = shape.box;
    return shapeItem(style, shape.kind, [x, y], [x + width, y + height]);
  }
  if (shape.kind === "polygon") return polygonItem(style, shape.corners);
  return shapeItem(style, shape.kind, shape.from, shape.to);
}

function startStroke(editor: Editor, sample: PointerSample): StrokeItem {
  const { color, size } = editor.style;
  const [x, y] = sample.world;
  const stroke = createItem<StrokeItem>({
    type: "stroke",
    x,
    y,
    color,
    size,
    points: [],
    pressure: sample.hasPressure,
    tip: "pen",
  });
  return { ...stroke, points: [relative(stroke, sample)] };
}

function gap(editor: Editor, draft: StrokeItem, sample: PointerSample): number {
  const [x = 0, y = 0] = draft.points.at(-1) ?? [];
  return Math.hypot(sample.world[0] - draft.x - x, sample.world[1] - draft.y - y) * editor.view.zoom;
}

export function createPen(editor: Editor, snapping: () => boolean): Tool {
  let draft: StrokeItem | null = null;
  let snapped: Item | null = null;
  let rest: { at: Vec; timer: ReturnType<typeof setTimeout> } | null = null;
  const stopResting = (): void => {
    if (rest !== null) clearTimeout(rest.timer);
    rest = null;
  };
  const restAt = (screen: Vec): void => {
    stopResting();
    if (!snapping()) return;
    const timer = setTimeout(() => {
      snapped = draft === null ? null : snap(editor, draft);
      if (snapped !== null) editor.setDraft([snapped]);
    }, HOLD_MS);
    rest = { at: screen, timer };
  };
  const reset = (): void => {
    stopResting();
    [draft, snapped] = [null, null];
    editor.setDraft([]);
  };
  return {
    cursor: "crosshair",
    down(sample) {
      draft = startStroke(editor, sample);
      editor.setDraft([draft]);
      restAt(sample.screen);
    },
    move(sample) {
      if (draft === null) return;
      const moved =
        rest === null ||
        Math.hypot(sample.screen[0] - rest.at[0], sample.screen[1] - rest.at[1]) > HOLD_SLACK;
      // Moving on after a snap means the pause was not meant as one: back to the freehand stroke.
      if (snapped !== null && !moved) return;
      snapped = null;
      if (gap(editor, draft, sample) >= MIN_GAP)
        draft = { ...draft, points: [...draft.points, relative(draft, sample)] };
      editor.setDraft([draft]);
      if (moved) restAt(sample.screen);
    },
    up() {
      const finished = snapped ?? draft;
      reset();
      if (finished !== null) editor.commit([finished]);
    },
    cancel: reset,
  };
}
