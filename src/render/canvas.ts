// Draws a list of items onto a 2D canvas for a given viewport. Not here: when to draw (src/ui/stage.ts).
import type { Viewport } from "../editor/viewport.ts";
import type { Item, MarkItem } from "../model/item.ts";
import type { Ink } from "./ink.ts";
import { markOps } from "./marks.ts";
import { handFont } from "./measure.ts";
import { opsFor, type PathOp, type TextOp } from "./ops.ts";

const paths = new WeakMap<PathOp, Path2D>();

function pathOf(op: PathOp): Path2D {
  let path = paths.get(op);
  if (path === undefined) {
    path = new Path2D(op.d);
    paths.set(op, path);
  }
  return path;
}

function write(context: CanvasRenderingContext2D, op: TextOp, ink: Ink): void {
  context.font = handFont(op.fontSize);
  context.textBaseline = "top";
  context.fillStyle = ink.colors[op.color];
  op.lines.forEach((line, index) => {
    context.fillText(line, op.x, op.y + index * op.lineHeight);
  });
}

function paint(context: CanvasRenderingContext2D, op: PathOp, ink: Ink, color: string | null): void {
  const path = pathOf(op);
  context.globalAlpha = op.opacity;
  if (op.fill !== null) {
    context.fillStyle = color ?? ink.colors[op.fill];
    context.fill(path);
  }
  if (op.stroke !== null) {
    context.strokeStyle = color ?? ink.colors[op.stroke];
    context.lineWidth = op.width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke(path);
  }
  context.globalAlpha = 1;
}

function drawItem(context: CanvasRenderingContext2D, item: Item, ink: Ink): void {
  context.save();
  context.translate(item.x, item.y);
  const ops = opsFor(item);
  for (const op of ops) {
    if (op.kind !== "path" || !op.shadow) continue;
    context.save();
    context.translate(ink.shadow[0], ink.shadow[1]);
    paint(context, op, ink, ink.colors.ink);
    context.restore();
  }
  for (const op of ops) {
    if (op.kind === "path") paint(context, op, ink, null);
    else write(context, op, ink);
  }
  context.restore();
}

function drawMarks(
  context: CanvasRenderingContext2D,
  marks: readonly MarkItem[],
  target: Item,
  layer: MarkItem["layer"],
  ink: Ink,
): void {
  if (target.type !== "text") return;
  for (const mark of marks) {
    if (mark.layer !== layer) continue;
    for (const op of markOps(mark, target)) paint(context, op, ink, null);
  }
}

export interface Scene {
  readonly items: readonly Item[];
  readonly view: Viewport;
  // Canvas size in CSS pixels and the device pixel ratio.
  readonly width: number;
  readonly height: number;
  readonly ratio: number;
}

export function drawScene(context: CanvasRenderingContext2D, scene: Scene, ink: Ink): void {
  const { view, ratio } = scene;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = ink.canvas;
  context.fillRect(0, 0, scene.width, scene.height);
  context.setTransform(
    ratio * view.zoom,
    0,
    0,
    ratio * view.zoom,
    -view.x * view.zoom * ratio,
    -view.y * view.zoom * ratio,
  );
  const marks = new Map<string, MarkItem[]>();
  for (const item of scene.items) {
    if (item.type === "mark" && !item.deleted)
      marks.set(item.target, [...(marks.get(item.target) ?? []), item]);
  }
  for (const item of scene.items) {
    if (item.deleted || item.type === "mark") continue;
    const own = item.type === "text" ? (marks.get(item.id) ?? []) : [];
    drawMarks(context, own, item, "behind", ink);
    drawItem(context, item, ink);
    drawMarks(context, own, item, "over", ink);
  }
}
