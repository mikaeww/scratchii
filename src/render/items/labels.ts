// Draw operations for labels (ADR 0007): centred and wrapped inside a box, ellipse or polygon; on a paper
// patch at the middle of a line or arrow, so the line does not run through the words.
import { LINE_HEIGHT, NOTE_FONT_SIZE } from "../../geometry/widths.ts";
import type { LineItem, PolygonItem, ShapeItem } from "../../model/item.ts";
import { lineWidth, wrapText } from "../measure.ts";
import type { DrawOp } from "../ops.ts";

// Space between a label and its shape's edge, and around a line label's paper patch (world units).
const INSET = 12;
const PATCH = 6;
const LINE_LABEL_WIDTH = 220;

export function shapeLabelOps(item: ShapeItem | PolygonItem): DrawOp[] {
  if (item.label === "") return [];
  const fontSize = NOTE_FONT_SIZE[item.size];
  const lines = wrapText(item.label, fontSize, Math.max(fontSize, item.width - 2 * INSET));
  const lineHeight = fontSize * LINE_HEIGHT;
  return [
    {
      kind: "text",
      lines,
      x: item.width / 2,
      y: (item.height - lines.length * lineHeight) / 2,
      fontSize,
      lineHeight,
      color: item.color,
      align: "middle",
    },
  ];
}

export function lineLabelOps(item: LineItem): DrawOp[] {
  if (item.label === "") return [];
  const fontSize = NOTE_FONT_SIZE[item.size];
  const lineHeight = fontSize * LINE_HEIGHT;
  const lines = wrapText(item.label, fontSize, LINE_LABEL_WIDTH);
  const [[ax, ay], [bx, by]] = item.points;
  const [mx, my] = [(ax + bx) / 2, (ay + by) / 2];
  const width = Math.max(...lines.map((line) => lineWidth(line, fontSize))) + 2 * PATCH;
  const height = lines.length * lineHeight + PATCH;
  const [left, top] = [mx - width / 2, my - height / 2];
  return [
    {
      kind: "path",
      d: `M${left} ${top}h${width}v${height}h${-width}Z`,
      fill: "paper",
      stroke: null,
      width: 0,
      shadow: false,
      opacity: 1,
    },
    {
      kind: "text",
      lines,
      x: mx,
      y: top + PATCH / 2,
      fontSize,
      lineHeight,
      color: item.color,
      align: "middle",
    },
  ];
}
