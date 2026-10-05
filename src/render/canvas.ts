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
  context.textAlign = op.align === "middle" ? "center" : op.align === "end" ? "right" : "left";
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
  // Only the live canvas shows the paper; exports and previews leave it out.
  readonly paper?: Paper;
}

export const PAPERS = ["plain", "dots", "squares", "lines"] as const;
export type Paper = (typeof PAPERS)[number];

// World units between dots at zoom 1; zoomed out, the step doubles until the dots are this far apart on screen.
const GRID = 28;
const GRID_MIN_SPACING = 14;
const DOT_RADIUS = 1.4;

export function gridStep(zoom: number): number {
  let step = GRID;
  while (step * zoom < GRID_MIN_SPACING) step *= 2;
  return step;
}

let gridTile: { readonly key: string; readonly pattern: CanvasPattern } | null = null;

// One tile of the paper, everything centred on the tile's middle so all papers share the grid points.
function paperPattern(
  context: CanvasRenderingContext2D,
  paper: Exclude<Paper, "plain">,
  size: number,
  ratio: number,
  color: string,
): CanvasPattern | null {
  const key = `${paper}:${size}:${ratio}:${color}`;
  if (gridTile?.key === key) return gridTile.pattern;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const tileContext = tile.getContext("2d");
  if (tileContext === null) return null;
  tileContext.fillStyle = color;
  const [middle, line] = [size / 2, Math.max(1, Math.round(ratio))];
  if (paper === "dots") {
    tileContext.arc(middle, middle, DOT_RADIUS * ratio, 0, Math.PI * 2);
    tileContext.fill();
  } else {
    tileContext.fillRect(0, Math.round(middle - line / 2), size, line);
    if (paper === "squares") tileContext.fillRect(Math.round(middle - line / 2), 0, line, size);
  }
  const pattern = context.createPattern(tile, "repeat");
  gridTile = pattern === null ? null : { key, pattern };
  return pattern;
}

// One tile repeated by a pattern, in device pixels: a single fill per frame. One arc per dot cost up to
// 250 ms a frame in WebKitGTK when zoomed out.
function drawPaper(
  context: CanvasRenderingContext2D,
  scene: Scene,
  ink: Ink,
  paper: Exclude<Paper, "plain">,
): void {
  const { view, ratio } = scene;
  const step = gridStep(view.zoom);
  const spacing = step * view.zoom * ratio;
  const size = Math.ceil(spacing);
  const pattern = paperPattern(context, paper, size, ratio, ink.colors.ink);
  if (pattern === null) return;
  const offsetX = (Math.floor(view.x / step) * step - view.x) * view.zoom * ratio;
  const offsetY = (Math.floor(view.y / step) * step - view.y) * view.zoom * ratio;
  pattern.setTransform(
    new DOMMatrix().translateSelf(offsetX - spacing / 2, offsetY - spacing / 2).scaleSelf(spacing / size),
  );
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = pattern;
  // Lines cover more of the page than dots, so they are drawn lighter.
  context.globalAlpha = paper === "dots" ? 0.22 : 0.12;
  context.fillRect(0, 0, scene.width * ratio, scene.height * ratio);
  context.globalAlpha = 1;
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
  if (scene.paper !== undefined && scene.paper !== "plain") drawPaper(context, scene, ink, scene.paper);
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
