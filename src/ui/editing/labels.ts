// Typing a label (ADR 0007): where the field sits over a shape or at the middle of a line, and the item it
// leaves behind. Not here: the field itself (text-editor.ts) or drawing labels (src/render/items/labels.ts).
import { curveMiddle } from "../../geometry/outline.ts";
import { LINE_HEIGHT, NOTE_FONT_SIZE } from "../../geometry/widths.ts";
import { reviseItem, type LineItem, type PolygonItem, type ShapeItem } from "../../model/item.ts";
import { wrapText } from "../../render/measure.ts";

export type Labelled = ShapeItem | PolygonItem | LineItem;

// Matches the drawing: 12 units inside a shape, 220 wide on a line.
const INSET = 12;
const LINE_LABEL_WIDTH = 220;

export function isLabelled(item: { readonly type: string }): item is Labelled {
  return ["rect", "ellipse", "polygon", "line", "arrow"].includes(item.type);
}

export function labelField(
  item: Labelled,
  value: string,
): { x: number; y: number; width: number; height: number; fontSize: number } {
  const fontSize = NOTE_FONT_SIZE[item.size];
  const lineHeight = fontSize * LINE_HEIGHT;
  if ("points" in item) {
    const [a, b] = item.points;
    const middle = curveMiddle(a, b, item.bend);
    const lines = wrapText(value || " ", fontSize, LINE_LABEL_WIDTH).length;
    const height = lines * lineHeight;
    const [mx, my] = [item.x + middle[0], item.y + middle[1]];
    return { x: mx - LINE_LABEL_WIDTH / 2, y: my - height / 2, width: LINE_LABEL_WIDTH, height, fontSize };
  }
  const width = Math.max(fontSize, item.width - 2 * INSET);
  const height = wrapText(value || " ", fontSize, width).length * lineHeight;
  return { x: item.x + INSET, y: item.y + (item.height - height) / 2, width, height, fontSize };
}

export function finishedLabel(item: Labelled, value: string): Labelled | null {
  return item.label === value ? null : reviseItem({ ...item, label: value });
}
