// Draws a list of items onto a 2D canvas for a given viewport. Not here: when to draw (src/ui/stage.ts).
import type { Viewport } from "../editor/viewport.ts";
import type { Item } from "../model/item.ts";
import { imageFor } from "./images.ts";
import type { Ink } from "./ink.ts";
import { handFont } from "./measure.ts";
import type { ImageOp, PathOp, TextOp } from "./ops.ts";
import { paintOrder, type PaintStep } from "./order.ts";

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

function drawImage(context: CanvasRenderingContext2D, op: ImageOp, onImage: () => void): void {
  const image = imageFor(op.src, onImage);
  if (image !== null) context.drawImage(image, 0, 0, op.width, op.height);
}

function drawStep(context: CanvasRenderingContext2D, step: PaintStep, ink: Ink, onImage: () => void): void {
  context.save();
  context.translate(step.origin[0], step.origin[1]);
  for (const op of step.ops) {
    if (op.kind !== "path" || !op.shadow) continue;
    context.save();
    context.translate(ink.shadow[0], ink.shadow[1]);
    paint(context, op, ink, ink.colors.ink);
    context.restore();
  }
  for (const op of step.ops) {
    if (op.kind === "path") paint(context, op, ink, null);
    else if (op.kind === "text") write(context, op, ink);
    else drawImage(context, op, onImage);
  }
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

// onImage is called when a picture that was still decoding becomes ready, so the caller can draw again.
export function drawScene(
  context: CanvasRenderingContext2D,
  scene: Scene,
  ink: Ink,
  onImage = (): void => undefined,
): void {
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
  for (const step of paintOrder(scene.items)) drawStep(context, step, ink, onImage);
}
