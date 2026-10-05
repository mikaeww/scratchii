// Draws the selection frame, its handles and the marquee in screen space, above the scene.
import type { Editor } from "../editor/editor.ts";
import {
  HANDLE_SIZE,
  HANDLES,
  bendHandle,
  bendable,
  endHandles,
  frameOf,
  handlePoint,
  selectionBox,
} from "../editor/selection.ts";
import type { Viewport } from "../editor/viewport.ts";
import type { Box } from "../geometry/box.ts";
import type { LineItem } from "../model/item.ts";
import type { Ink } from "./ink.ts";

const DASH = [6, 5];

function dashed(context: CanvasRenderingContext2D, box: Box): void {
  context.setLineDash(DASH);
  context.strokeRect(box.x, box.y, box.width, box.height);
  context.setLineDash([]);
}

function square(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.fillRect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
  context.strokeRect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
}

// The item a line end would attach to: a thick violet outline, the colour the marquee uses.
function drawHint(context: CanvasRenderingContext2D, box: Box, ink: Ink): void {
  context.save();
  context.strokeStyle = ink.colors.violet;
  context.lineWidth = 3;
  context.strokeRect(box.x, box.y, box.width, box.height);
  context.restore();
}

// A single line has square handles on its ends, which move and attach them, and a round one at its middle,
// which bends it; no frame and no corner handles.
function drawLineHandles(context: CanvasRenderingContext2D, line: LineItem, view: Viewport, ink: Ink): void {
  context.fillStyle = ink.colors.paper;
  for (const [x, y] of endHandles(line, view)) square(context, x, y);
  const [x, y] = bendHandle(line, view);
  context.beginPath();
  context.arc(x, y, HANDLE_SIZE / 2 + 1, 0, Math.PI * 2);
  context.fill();
  context.stroke();
}

export function drawOverlay(
  context: CanvasRenderingContext2D,
  editor: Editor,
  ink: Ink,
  ratio: number,
): void {
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.lineWidth = 2;
  context.strokeStyle = ink.colors.ink;
  if (editor.marquee !== null) {
    const box = frameOf(editor.marquee, editor.view, 0);
    context.fillStyle = ink.colors.violet;
    context.globalAlpha = 0.15;
    context.fillRect(box.x, box.y, box.width, box.height);
    context.globalAlpha = 1;
    dashed(context, box);
    return;
  }
  if (editor.hint !== null) drawHint(context, frameOf(editor.hint, editor.view), ink);
  const live = new Map(editor.scene().map((item) => [item.id, item]));
  const selected = [...editor.selection].flatMap((id) => live.get(id) ?? []);
  const line = bendable(selected);
  if (line !== null) {
    drawLineHandles(context, line, editor.view, ink);
    return;
  }
  const world = selectionBox(selected);
  if (world === null) return;
  const frame = frameOf(world, editor.view);
  dashed(context, frame);
  context.fillStyle = ink.colors.paper;
  for (const handle of HANDLES) {
    const [x, y] = handlePoint(frame, handle);
    square(context, x, y);
  }
}
