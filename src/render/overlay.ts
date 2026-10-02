// Draws the selection frame, its handles and the marquee in screen space, above the scene.
import type { Editor } from "../editor/editor.ts";
import { HANDLE_SIZE, HANDLES, frameOf, handlePoint, selectionBox } from "../editor/selection.ts";
import type { Box } from "../geometry/box.ts";
import type { Ink } from "./ink.ts";

const DASH = [6, 5];

function dashed(context: CanvasRenderingContext2D, box: Box): void {
  context.setLineDash(DASH);
  context.strokeRect(box.x, box.y, box.width, box.height);
  context.setLineDash([]);
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
  const live = new Map(editor.scene().map((item) => [item.id, item]));
  const world = selectionBox([...editor.selection].flatMap((id) => live.get(id) ?? []));
  if (world === null) return;
  const frame = frameOf(world, editor.view);
  dashed(context, frame);
  context.fillStyle = ink.colors.paper;
  for (const handle of HANDLES) {
    const [x, y] = handlePoint(frame, handle);
    context.fillRect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    context.strokeRect(x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
  }
}
