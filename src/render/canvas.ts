// Draws a list of items onto a 2D canvas for a given viewport. Not here: when to draw (src/ui/stage.ts).
import type { Viewport } from "../editor/viewport.ts";
import type { Item } from "../model/item.ts";
import type { Ink } from "./ink.ts";
import { opsFor, type DrawOp } from "./ops.ts";

const paths = new WeakMap<DrawOp, Path2D>();

function pathOf(op: DrawOp): Path2D {
  let path = paths.get(op);
  if (path === undefined) {
    path = new Path2D(op.d);
    paths.set(op, path);
  }
  return path;
}

function paint(context: CanvasRenderingContext2D, op: DrawOp, ink: Ink, color: string | null): void {
  const path = pathOf(op);
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
}

function drawItem(context: CanvasRenderingContext2D, item: Item, ink: Ink): void {
  context.save();
  context.translate(item.x, item.y);
  const ops = opsFor(item);
  for (const op of ops) {
    if (!op.shadow) continue;
    context.save();
    context.translate(ink.shadow[0], ink.shadow[1]);
    paint(context, op, ink, ink.colors.ink);
    context.restore();
  }
  for (const op of ops) paint(context, op, ink, null);
  context.restore();
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
  for (const item of scene.items) {
    if (!item.deleted) drawItem(context, item, ink);
  }
}
