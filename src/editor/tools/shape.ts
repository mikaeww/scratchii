// Box, ellipse, triangle, diamond, star, line and arrow: drag from one corner (or end) to the other. Shift makes
// squares, circles, even polygons and lines in 45° steps.
import { attachEnds } from "../../diagram/connect.ts";
import { shapeBox } from "../../geometry/bounds.ts";
import { boxFromPoints } from "../../geometry/box.ts";
import { PRESET_CORNERS, fitCorners, type PolygonKind } from "../../geometry/polygon.ts";
import { createItem, type Item, type LineItem, type PolygonItem, type ShapeItem } from "../../model/item.ts";
import type { Editor, Style } from "../editor.ts";
import type { Vec } from "../viewport.ts";
import type { PointerSample, Tool } from "./tool.ts";

export type ShapeKind = "rect" | "ellipse" | PolygonKind | "line" | "arrow";

// Below this drag distance (world units) a press is a click, not a shape.
const MIN_SIZE = 3;
// Screen pixels around an item within which a line end attaches to it.
const ATTACH_REACH = 10;

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

// Corners in world coordinates; the item keeps them as fractions of their box.
export function polygonItem(style: Style, points: readonly Vec[]): PolygonItem {
  const { color, size, fill } = style;
  const { box, corners } = fitCorners(points);
  return createItem<PolygonItem>({ type: "polygon", ...box, color, size, fill, corners, label: "" });
}

export function shapeItem(style: Style, kind: ShapeKind, start: Vec, end: Vec): Item {
  const { color, size, fill } = style;
  if (kind === "triangle" || kind === "diamond" || kind === "star") {
    const box = boxFromPoints(start, end);
    return createItem<PolygonItem>({
      type: "polygon",
      ...box,
      color,
      size,
      fill,
      corners: PRESET_CORNERS[kind],
      label: "",
    });
  }
  if (kind === "line" || kind === "arrow") {
    const points: LineItem["points"] = [
      [0, 0],
      [end[0] - start[0], end[1] - start[1]],
    ];
    const line = { type: kind, x: start[0], y: start[1], color, size, points, label: "" } as const;
    return createItem<LineItem>({ ...line, ends: [null, null], bend: 0 });
  }
  return createItem<ShapeItem>({ type: kind, ...boxFromPoints(start, end), color, size, fill, label: "" });
}

export function createShapeTool(editor: Editor, kind: ShapeKind): Tool {
  let start: Vec | null = null;
  let draft: Item | null = null;
  // Ends over an item attach to it; the item the moving end would attach to is highlighted.
  const attached = (item: Item): Item => {
    if (item.type !== "line" && item.type !== "arrow") return item;
    const line = attachEnds(item, editor.scene(), ATTACH_REACH / editor.view.zoom);
    const target = editor.scene().find((other) => other.id === line.ends[1]);
    editor.setHint(target === undefined ? null : shapeBox(target));
    return line;
  };
  const update = (sample: PointerSample): void => {
    if (start === null) return;
    const end = sample.shift ? constrain(start, sample.world, kind) : sample.world;
    // Keep the id while dragging, so the draft stays one item.
    const next = attached(shapeItem(editor.style, kind, start, end));
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
      editor.setHint(null);
      if (finished === null || origin === null) return;
      if (Math.hypot(sample.world[0] - origin[0], sample.world[1] - origin[1]) < MIN_SIZE) return;
      editor.commit([finished]);
    },
    cancel() {
      start = null;
      draft = null;
      editor.setDraft([]);
      editor.setHint(null);
    },
  };
}
